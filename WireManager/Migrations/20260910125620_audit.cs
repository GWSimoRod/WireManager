using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace WireManager.Core.Migrations
{
    /// <inheritdoc />
    public partial class audit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "PersistentKeepAlive",
                table: "ConfPeers",
                type: "int",
                nullable: true,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "Audits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    Timestamp = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    ActorId = table.Column<string>(type: "longtext", nullable: false),
                    ActorType = table.Column<string>(type: "longtext", nullable: false),
                    Action = table.Column<string>(type: "longtext", nullable: false),
                    Entity = table.Column<string>(type: "longtext", nullable: false),
                    EntityId = table.Column<string>(type: "longtext", nullable: true),
                    IsSuccess = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    Details = table.Column<string>(type: "longtext", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Audits", x => x.Id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Audits");

            migrationBuilder.AlterColumn<int>(
                name: "PersistentKeepAlive",
                table: "ConfPeers",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true,
                oldDefaultValue: 0);
        }
    }
}
