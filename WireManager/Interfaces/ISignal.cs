using WireManager.Core.Models;

namespace WireManager.Core.Interfaces
{
    public interface ISignal
    {
        /// <summary>
        /// Invia una notifica gia salvata alle connessioni degli UUID destinatari.
        /// L'invio e best effort: gli errori di trasporto vengono registrati
        /// senza compromettere il salvataggio della notifica.
        /// </summary>
        Task SendNotificationAsync(Notification notification, IReadOnlyList<string> userUuids);
    }
}
