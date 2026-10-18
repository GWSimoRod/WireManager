using WireManager.IDS.Models;

namespace WireManager.IDS.Scoring
{
    public class IdsScoreCalculator
    {
        public int CalculateScore(IReadOnlyList<DetectionResult> detectionResults)
        {
           
            int totalScore = 0;

            foreach (var result in detectionResults)
            {
                
                int eventCount = Math.Max(result.EventCount, 1);

                int eventBonus = (int)Math.Floor(
                    3*Math.Log2(eventCount)
                 );

                totalScore += (int)result.Score + eventBonus;

            }

            return totalScore;

        }

    }
}
