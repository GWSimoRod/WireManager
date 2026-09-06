using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WireManager.Core.Migrations
{
    /// <inheritdoc />
    public partial class UUIDuser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UUID",
                table: "Users",
                type: "longtext",
                nullable: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UUID",
                table: "Users");
        }
    }
}
