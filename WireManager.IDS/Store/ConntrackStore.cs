using System.Collections.Concurrent;
using WireManager.IDS.Models;

namespace WireManager.IDS.Store
{
    public class ConntrackStore
    {

        private readonly ConcurrentDictionary<
            int,
            ConcurrentQueue<NetworkConnectionEvent>
        > _events = new();

        private const int MaxEventsPerPeer = 500;
        private static readonly TimeSpan EventTTL = TimeSpan.FromMinutes(5);

        public void Add(NetworkConnectionEvent connectionEvent)
        {
           
            if(connectionEvent.PeerId == null)
                return;

            var peerId = connectionEvent.PeerId.Value;

            var queue = _events.GetOrAdd(
                peerId,
                _ => new ConcurrentQueue<NetworkConnectionEvent>()
            );

            queue.Enqueue(connectionEvent);

            // Rimuovo gli eventi più vecchi se la coda supera la dimensione massima consentita
            ManageQueueSize(queue);

        }

        public IReadOnlyList<NetworkConnectionEvent> ReadAllQueue(int peerId)
        {
            if (_events.TryGetValue(peerId, out var queue))
            {
                return queue.ToArray();
            }
            return Array.Empty<NetworkConnectionEvent>();
        }

        public IReadOnlyList<NetworkConnectionEvent> ReadRecent(
            int peerId,
            TimeSpan window)
        {
            if (!_events.TryGetValue(peerId, out var queue))
                return [];

            var cutoff = DateTime.UtcNow - window;

            return queue
                .Where(e => e.Timestamp >= cutoff)
                .ToArray();
        }

        public void ClearQueue(int peerId)
        {
            _events.TryRemove(peerId, out _);
        }

        private void ManageQueueSize(
            ConcurrentQueue<NetworkConnectionEvent> queue)
        {
            var expirationTime = DateTime.UtcNow - EventTTL;

            while (queue.TryPeek(out var oldestEvent))
            {
                if (oldestEvent.Timestamp < expirationTime ||
                    queue.Count > MaxEventsPerPeer)
                {
                    queue.TryDequeue(out _);
                }
                else
                {
                    break;
                }
            }
        }

    }
}
