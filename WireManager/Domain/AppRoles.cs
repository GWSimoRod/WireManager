namespace WireManager.Core.Domain
{
    public static class AppRoles
    {
        public const string Admin = "Admin";
        public const string Operator = "Operator";

        public static readonly IReadOnlyList<string> All = [Admin, Operator];

        public static bool IsValid(string? role) =>
            !string.IsNullOrWhiteSpace(role) &&
            All.Contains(role, StringComparer.OrdinalIgnoreCase);

    }
}
