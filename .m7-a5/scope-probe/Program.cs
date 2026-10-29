using Assert = ContractScribe.Tests.ProbeAssert;
using System.Collections.Immutable;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.ExceptionServices;
using System.Text.Json;
using ContractScribe.Cli;
using ContractScribe.Core;
using ContractScribe.Core.Hosting;
using ContractScribe.Roslyn;

namespace ContractScribe.Tests;


public sealed class ActualAaRepositoryScopeProbe
{
    public async Task Actual_AA_builder_advertised_read_scopes_join_the_production_session()
    {
        var evidence = Path.GetFullPath("TestResults/scribe-scope-diagnosis", Environment.GetEnvironmentVariable("AA_PROBE_WORKDIR")!);
        using var paths = JsonDocument.Parse(File.ReadAllBytes(Path.Join(evidence, "local-paths.json")));
        string PathValue(string name) => paths.RootElement.GetProperty(name).GetString()!;
        var root = PathValue("target");
        var arguments = new CampaignCommandArguments(CampaignOperation.Start, root,
            Path.Join(root, "App/App.csproj"), Path.Join(root, "policy.json"),
            "actual-aa-4e223-credential-free-probe", PathValue("state"), PathValue("consumer"), null,
            "campaign.m7.a5.scope.probe");
        var preflight = CampaignPreflight.Run(arguments, root);
        var configuration = preflight.Configuration.Document;
        var rows = new List<object>();
        var invalid = new List<string>();
        var pairs = 0;
        Exception? consumerFailure = null;
        var host = new ProductionRepositorySessionHost(new HostBuildProvenance(CliBuildIdentity.Current.SourceRevision));
        var outcome = await host.RunAsync(new(root, Path.Join(root, "App/App.csproj"),
            File.ReadAllBytes(Path.Join(root, "policy.json")), null, PublishResult: false),
            new(SessionConsumer: async (bundle, token) =>
            {
                try
                {
                    using var audit = JsonDocument.Parse(bundle.CanonicalAudit);
                    var counts = audit.RootElement.GetProperty("results").EnumerateArray()
                        .GroupBy(x => x.GetProperty("auditOutcome").GetString()!).ToDictionary(x => x.Key, x => x.Count());
                    Assert.Equal(6, counts["audit.outcome.violation"]);
                    Assert.Equal(7, counts["audit.outcome.compliant"]);
                    var policy = configuration.CreateExecutionPolicy();
                    var planning = CampaignCommandRunner.CreatePlanningInput(preflight, configuration, policy, bundle,
                        token, new CampaignInvocationTargetLimit(2));
                    var plan = CampaignPlanner.Plan(planning);
                    var targets = plan.WorkItems.SelectMany(w => w.Targets).Where(t => t.M3Eligible)
                        .OrderBy(t => t.SymbolRef.DocumentationCommentId, StringComparer.Ordinal).ToArray();
                    Assert.Equal(6, targets.Length);
                    for (var left = 0; left < targets.Length; left++)
                    for (var right = left + 1; right < targets.Length; right++)
                    {
                        pairs++;
                        ImmutableArray<CampaignPlanningTargetFact> selected = [targets[left], targets[right]];
                        var built = CampaignScribeRequestBuilder.BuildManifest(bundle, selected,
                            selected.Select(t => t.SymbolRef).ToImmutableArray(), policy, configuration, token);
                        var request = DocumentationScribeValidation.ParseRequest(built.RequestUtf8Json).Request!;
                        Assert.True(DocumentationScribeAttemptId.TryParse("scribe-attempt." + Guid.NewGuid().ToString("N"), out var attempt));
                        var method = typeof(DocumentationScribeComposition).GetMethod("PreflightAsync", BindingFlags.NonPublic | BindingFlags.Static)!;
                        var task = (Task)method.Invoke(null, [built.Selection.PrimaryAudit, request, attempt, null,
                            token, null, built.Selection, true])!;
                        await task;
                        var prepared = task.GetType().GetProperty("Result")!.GetValue(task)!;
                        Assert.Null(Property(prepared, "Failure"));
                        var loaded = (DocumentationScribeLoadedManifestContext)Property(prepared, "ManifestContext")!;
                        var scopes = (ImmutableArray<DocumentationScribeRepositoryToolScope>)Property(prepared, "RepositoryScopes")!;
                        var repository = (DocumentationScribeRepositoryToolBundle)Property(prepared, "Repository")!;
                        var original = (DocumentationScribeRepositoryToolSession)repository.ReadExcerpt.GetType()
                            .GetFields(BindingFlags.NonPublic | BindingFlags.Instance)
                            .Single(f => f.FieldType == typeof(DocumentationScribeRepositoryToolSession)).GetValue(repository.ReadExcerpt)!;
                        var limits = (DocumentationScribeRepositoryToolLimits)typeof(DocumentationScribeRepositoryToolSession)
                            .GetField("limits", BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(original)!;
                        using var schema = JsonDocument.Parse(DocumentationScribeComposition.BindRepositoryToolScopes(
                            DocumentationScribeRepositoryToolSchemas.ReadExcerptInputUtf8Json, scopes,
                            DocumentationScribeRepositoryToolOperations.ReadExcerpt));
                        var advertised = schema.RootElement.GetProperty("properties").GetProperty("scopeId")
                            .GetProperty("enum").EnumerateArray().Select(x => x.GetString()).ToHashSet();
                        foreach (var scope in scopes.Where(s => advertised.Contains(s.ScopeId)))
                        {
                            var path = scope.IsDirectory
                                ? request.ContextReferences.Single(c => c.ContextReferenceId == scope.ScopeId).Path
                                : scope.RepositoryPath;
                            var text = File.ReadAllText(Path.Join(root, path));
                            var last = text.Split('\n').Length;
                            var cases = new (string Name, string? Path, int? Start, int? End, bool Valid)[]
                            {
                                ("whole-default", scope.IsDirectory ? path : null, null, null, true),
                                ("whole-explicit-path", path, null, null, true),
                                ("whole-exact-lines", path, 1, last, true),
                                ("first-line", path, 1, 1, true),
                                ("last-line", path, last, last, true),
                                ("past-end-rejected", path, 1, last + 1, false),
                            };
                            foreach (var variant in cases)
                            {
                                var phases = new List<string>();
                                var branches = new HashSet<string>();
                                EventHandler<FirstChanceExceptionEventArgs> observer = (_, e) =>
                                {
                                    if (e.Exception.GetType().FullName != "ContractScribe.Roslyn.DocumentationScribeRepositoryToolSession+ToolFailure") return;
                                    foreach (var frame in new StackTrace(e.Exception, false).GetFrames())
                                    {
                                        var call = frame.GetMethod();
                                        if (call?.DeclaringType == typeof(DocumentationScribeRepositoryToolSession)
                                            && call.Name is "ReadExcerpt" or "SelectLines" or "ResolveFile" or "NormalizeRepositoryPath"
                                                or "CreateEvidence" or "CreateExcerpt" or "CreateRoute") branches.Add(call.Name);
                                    }
                                };
                                var session = new DocumentationScribeRepositoryToolSession(request, attempt,
                                    loaded.Contexts.First(), scopes, limits, point => phases.Add(point.ToString()), manifest: loaded);
                                AppDomain.CurrentDomain.FirstChanceException += observer;
                                DocumentationScribeRepositoryReadExcerptResult result;
                                try { result = session.ReadExcerpt(new(scope.ScopeId, variant.Path, variant.Start, variant.End), token); }
                                finally { AppDomain.CurrentDomain.FirstChanceException -= observer; }
                                rows.Add(new { pair = pairs, member = scope.Subject?.ParentSymbolRef.DocumentationCommentId,
                                    scope = scope.Role.ToString(), subject = scope.Subject is not null, claims = scope.ClaimCategoryIds,
                                    variant = variant.Name, expectedValid = variant.Valid, outcome = result.Outcome.Id,
                                    failure = result.FailureCode, dynamicEvidence = result.DynamicEvidence.Length,
                                    beforeEvidencePublication = phases.Contains("BeforeEvidencePublication"), branches });
                                if (variant.Valid && result.Outcome == DocumentationScribeToolOutcome.Failure)
                                    invalid.Add($"pair={pairs} member={scope.Subject?.ParentSymbolRef.DocumentationCommentId} scope={scope.Role} case={variant.Name} code={result.FailureCode} branch={string.Join(',', branches)}");
                                if (!variant.Valid) Assert.Equal(DocumentationScribeRepositoryToolFailureCodes.InvalidRequest, result.FailureCode);
                            }
                        }
                    }
                }
                catch (Exception e) { consumerFailure = e; }
            }));
        File.WriteAllText(Path.Join(evidence, "scope-probe-results.json"), JsonSerializer.Serialize(new
        { source = "8c1b0affecee1dd9b357b376bab8b2bd675a891b", syntheticTarget = "4e223e66952d717b97435b0cda1e65800f49624d",
            hostTerminal = outcome.Terminal, pairs, calls = rows.Count, failedValidRequests = invalid, rows }, new JsonSerializerOptions { WriteIndented = true }));
        Assert.Null(consumerFailure);
        Assert.Equal(15, pairs);
        Assert.NotEmpty(rows);
        Assert.True(invalid.Count == 0, string.Join(Environment.NewLine, invalid));
        GC.KeepAlive(outcome);
    }

    private static object? Property(object value, string name) => value.GetType()
        .GetProperty(name, BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(value);
}

internal static class ProbeAssert
{
    internal static void Equal<T>(T expected,T actual) { if(!EqualityComparer<T>.Default.Equals(expected,actual)) throw new InvalidOperationException("probe.count-mismatch"); }
    internal static void True(bool value,string? message=null) { if(!value) throw new InvalidOperationException("probe.condition-failed"); }
    internal static void Null(object? value) { if(value is not null) throw new InvalidOperationException("probe.unexpected-state"); }
    internal static void NotEmpty<T>(IEnumerable<T> values) { if(!values.Any()) throw new InvalidOperationException("probe.no-rows"); }
}
internal static class ProbeEntry
{
    static async Task<int> Main()
    {
        try { await new ActualAaRepositoryScopeProbe().Actual_AA_builder_advertised_read_scopes_join_the_production_session(); Console.WriteLine("scope-probe.complete");return 0; }
        catch { Console.Error.WriteLine("scope-probe.incomplete");return 1; }
    }
}
