using System.Diagnostics;
using System.Runtime.ExceptionServices;
using System.Text.Json;

internal static class StartupHook
{
    private const string SessionType = "ContractScribe.Roslyn.DocumentationScribeRepositoryToolSession";
    private static readonly HashSet<string> Allowed = new(StringComparer.Ordinal)
    { "ReadExcerpt", "SelectLines", "ResolveFile", "NormalizeRepositoryPath", "CreateEvidence", "CreateExcerpt", "CreateRoute", "GetScope", "BindScope" };
    private static string? output;
    private static int observations;
    [ThreadStatic] private static bool observing;

    public static void Initialize()
    {
        output = Environment.GetEnvironmentVariable("A5_CLOSED_BRANCH_OUTPUT");
        if (string.IsNullOrEmpty(output) || !Path.IsPathFullyQualified(output) || !File.Exists(output)) return;
        // Observe only. Keep the original startup environment and every product guard intact.
        AppDomain.CurrentDomain.FirstChanceException += Observe;
    }

    private static void Observe(object? sender, FirstChanceExceptionEventArgs args)
    {
        if (observing || output is null) return;
        var exception = args.Exception;
        var code = exception.GetType().FullName == SessionType + "+ToolFailure"
            ? exception.Message == "repository.invalid-request" ? "repository.invalid-request" : null
            : exception is ArgumentException ? "argument-exception" : null;
        if (code is null) return;
        observing = true;
        try
        {
            var methods = new StackTrace(exception, false).GetFrames()
                .Select(f => f.GetMethod()).Where(m => m?.DeclaringType?.FullName == SessionType && Allowed.Contains(m.Name))
                .Select(m => m!.Name).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray();
            if (methods.Length == 0 || Interlocked.Increment(ref observations) > 64) return;
            // No exception message, arguments, source content, file names, addresses or provider wire is serialized.
            var line = JsonSerializer.Serialize(new { failureCode = code, methods });
            if (line.Length > 512 || new FileInfo(output).Length > 32_768) return;
            File.AppendAllText(output, line + "\n");
        }
        catch { /* Observation cannot change the original application's exception or result. */ }
        finally { observing = false; }
    }
}
