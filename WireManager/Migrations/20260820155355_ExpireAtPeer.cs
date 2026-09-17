using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WireManager.Core.Migrations
{
    /// <inheritdoc />
    public partial class ExpireAtPeer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ExpireAt",
                table: "ConfPeers",
                type: "datetime(6)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExpireAt",
                table: "ConfPeers");
        }
    }
}
