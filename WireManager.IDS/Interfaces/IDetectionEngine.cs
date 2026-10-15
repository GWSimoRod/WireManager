using WireManager.IDS.Models;

namespace WireManager.IDS.Interfaces
{
    public interface IDetectionEngine
    {

        public IReadOnlyList<DetectionResult> Analyze(IReadOnlyList<NetworkConnectionEvent> events);

    }
}
