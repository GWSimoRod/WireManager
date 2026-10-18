using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WireManager.Core.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationUserType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // PeerId non e piu mappato dal modello, ma conserviamo la colonna
            // esistente per non perdere i dati delle notifiche precedenti.

            migrationBuilder.AddColumn<int>(
                name: "UserType",
                table: "Notifications",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddForeignKey(
                name: "FK_UserNotifications_Users_UserId",
                table: "UserNotifications",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserNotifications_Users_UserId",
                table: "UserNotifications");

            migrationBuilder.DropColumn(
                name: "UserType",
                table: "Notifications");

        }
    }
}
