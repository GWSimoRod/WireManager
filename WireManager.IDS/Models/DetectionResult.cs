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

        public long Id { get; set; }

        public int PeerId { get; set; }
        public string RuleName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DetectionSeverity Severity { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public int EventCount { get; set; } = 1;

        public int Score => Severity switch
        {
            DetectionSeverity.Low => 5,
            DetectionSeverity.Medium => 10,
            DetectionSeverity.High => 20,
            DetectionSeverity.Critical => 30,
            _ => 0
        };

    }
}
