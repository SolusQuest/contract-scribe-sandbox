# ContractScribe sandbox

Dedicated public synthetic validation repository for [ContractScribe issue #166](https://github.com/SolusQuest/contract-scribe/issues/166).

This repository contains original test code only. It contains no production data or downstream-private source. Its small C# project intentionally leaves one public method undocumented so ContractScribe can propose a bounded documentation change.

The `PR observer` workflow builds pull requests targeting `main` with read-only permissions. It is an observer, not a product publication workflow. Initial repository preparation does not activate ContractScribe or grant a product credential.

Generated proof branches, commits and draft pull requests are retained for evidence. Maintainer Yuee98 owns any later cleanup decision; automation must not merge, mark ready, close or delete them.

Build with `dotnet build Synthetic.csproj --configuration Release` using .NET 10.
