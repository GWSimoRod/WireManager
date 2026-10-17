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

        private readonly object _lock = new();
        private const int MaxEventsPerPeer = 500;
        private static readonly TimeSpan EventTTL = TimeSpan.FromMinutes(5);

        public void Add(NetworkConnectionEvent connectionEvent)
        {
            if (!connectionEvent.PeerId.HasValue)
                return;

            var peerId = connectionEvent.PeerId.Value;

            lock (_lock)
            {
                var queue = _events.GetOrAdd(
                    peerId,
                    _ => new ConcurrentQueue<NetworkConnectionEvent>());

                queue.Enqueue(connectionEvent);

                ManageQueueSize(queue);
            
            }

        }

        public IReadOnlyList<NetworkConnectionEvent> ReadAllQueue(int peerId)
        {
            lock (_lock)
            {
                if (_events.TryGetValue(peerId, out var queue))
                {
                    return queue.ToArray();
                }

                return [];
            }
        }

        public IReadOnlyList<NetworkConnectionEvent> ReadRecent(
            int peerId,
            TimeSpan window)
        {
            lock (_lock)
            {
                if (!_events.TryGetValue(peerId, out var queue))
                    return [];

                var cutoff = DateTime.UtcNow - window;

                return queue
                    .Where(e => e.Timestamp >= cutoff)
                    .ToArray();
            }
        }

        public void RemoveEvents(
            int peerId,
            IReadOnlyList<NetworkConnectionEvent> events)
        {
            if (events.Count == 0)
                return;

            lock (_lock)
            {
                if (!_events.TryGetValue(peerId, out var queue))
                    return;

                var toRemove = events.ToHashSet();

                var remaining = queue
                    .Where(e => !toRemove.Contains(e));

                _events[peerId] =
                    new ConcurrentQueue<NetworkConnectionEvent>(remaining);
            }
        }

        public void ClearQueue(int peerId)
        {
            lock (_lock)
            {
                _events.TryRemove(peerId, out _);
            }
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
