using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WireManager.Core.Migrations
{
    /// <inheritdoc />
    public partial class IdsToPeer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "IdsScore",
                table: "ConfPeers",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastIdsDetection",
                table: "ConfPeers",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastIdsScoreDecay",
                table: "ConfPeers",
                type: "datetime(6)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IdsScore",
                table: "ConfPeers");

            migrationBuilder.DropColumn(
                name: "LastIdsDetection",
                table: "ConfPeers");

            migrationBuilder.DropColumn(
                name: "LastIdsScoreDecay",
                table: "ConfPeers");
        }
    }
}
