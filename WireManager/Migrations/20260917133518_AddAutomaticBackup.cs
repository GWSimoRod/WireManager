using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace WireManager.Core.Migrations
{
    public partial class AddAutomaticBackup : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AutomaticBackups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation(
                            "MySQL:ValueGenerationStrategy",
                            MySQLValueGenerationStrategy.IdentityColumn),

                    Enabled = table.Column<bool>(
                        type: "tinyint(1)",
                        nullable: false),

                    Password = table.Column<string>(
                        type: "longtext",
                        nullable: false),

                    retention = table.Column<int>(
                        type: "int",
                        nullable: false),

                    Schedule = table.Column<TimeSpan>(
                        type: "time(6)",
                        nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey(
                        "PK_AutomaticBackups",
                        x => x.Id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AutomaticBackups");
        }
    }
}