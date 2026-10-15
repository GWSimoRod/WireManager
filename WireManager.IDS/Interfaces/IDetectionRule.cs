using WireManager.IDS.Models;

namespace WireManager.IDS.Interfaces
{
    public interface IDetectionRule
    {
        string Name { get; }

        IEnumerable<DetectionResult> Evaluate(IReadOnlyList<NetworkConnectionEvent> connectionEvent);
    }
}
