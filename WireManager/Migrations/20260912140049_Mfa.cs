using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WireManager.Core.Migrations
{
    /// <inheritdoc />
    public partial class Mfa : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "mfaEnabled",
                table: "Users",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "mfaSecret",
                table: "Users",
                type: "longtext",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "mfaEnabled",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "mfaSecret",
                table: "Users");
        }
    }
}
