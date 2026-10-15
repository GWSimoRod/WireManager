namespace WireManager.IDS.Models
{
    public enum DetectionSeverity
    {
        Low,
        Medium,
        High,
        Critical
    }
    public class DetectionResult
    {

        public int PeerId { get; set; }
        public string RuleName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DetectionSeverity Severity { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public int EventCount { get; set; } = 1;

    }
}
