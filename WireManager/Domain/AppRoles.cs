namespace WireManager.Core.Domain
{
    public static class AppRoles
    {
        public const string Admin = "Admin";
        public const string Operator = "Operator";
        public const string Disabled = "Disabled";
        public const string SSO_Exchange = "SSO_Exchange";
        public static readonly IReadOnlyList<string> All = [Admin, Operator, Disabled, SSO_Exchange];

        public static bool IsValid(string? role) =>
            !string.IsNullOrWhiteSpace(role) &&
            All.Contains(role, StringComparer.OrdinalIgnoreCase);

    }
}
