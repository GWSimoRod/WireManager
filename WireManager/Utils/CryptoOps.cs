using NSec.Cryptography;

namespace WireManager.Core.Utils
{
    internal class CryptoOps
    {
        //<summary>
        // Genera un paio di chiavi (privata e pubblica) utilizzando l'algoritmo X25519.
        //</summary>
        //<returns>
        // Paio di chiavi (PrivateKey, PublicKey) in formato Base64.
        //</returns>
        public static (string PrivateKey, string PublicKey) GenerateKeyPair()
        {
            var algorithm = KeyAgreementAlgorithm.X25519;

            using var key = Key.Create(algorithm, new KeyCreationParameters
            {
                ExportPolicy = KeyExportPolicies.AllowPlaintextExport
            });

            // Esporta chiave privata (32 byte, formato raw)
            byte[] privateKeyBytes = key.Export(KeyBlobFormat.RawPrivateKey);

            // Deriva la chiave pubblica dalla privata (matematicamente corretta)
            byte[] publicKeyBytes = key.PublicKey.Export(KeyBlobFormat.RawPublicKey);

            string privateKeyBase64 = Convert.ToBase64String(privateKeyBytes);
            string publicKeyBase64 = Convert.ToBase64String(publicKeyBytes);

            return (privateKeyBase64, publicKeyBase64);
        }


    }
}
