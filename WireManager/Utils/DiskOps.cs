namespace WireManager.Core.Utils
{
    public class DiskOps
    {
        // gestire path sia default che custom
        private static string BaseFolder = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "config"));
        public static string _baseFolderPath => BaseFolder;
        public static string _baseFolderPathPeer => Path.Combine(_baseFolderPath, "peers");
        public static string _baseFolderPathServer => Path.Combine(_baseFolderPath, "wg_confs");

        // inizializzo le path

        public static void InitializePaths(string? customBasePath = null)
        {
            Console.WriteLine("Custom base path: " + customBasePath);
            if (!string.IsNullOrWhiteSpace(customBasePath))
            {
                BaseFolder = customBasePath;
            }

            EnsureDirectoriesExist();
        }

        public static void EnsureDirectoriesExist()
        {
            Directory.CreateDirectory(_baseFolderPath);
            Directory.CreateDirectory(_baseFolderPathPeer);
            Directory.CreateDirectory(_baseFolderPathServer);
            
            // stampo tutte le path

            Console.WriteLine($"Base folder path: {_baseFolderPath}");
            Console.WriteLine($"Peer folder path: {_baseFolderPathPeer}");
            Console.WriteLine($"Server folder path: {_baseFolderPathServer}");

            string absoluteFilePath = Path.GetFullPath(_baseFolderPath);
            Console.WriteLine($"[DEBUG PATH] => {absoluteFilePath}");

        }

        public async static Task WriteToFileAsync(string fileName, string content)
        {
            await WriteToFileAsync(fileName, content, _baseFolderPath);
        }

        public async static Task WriteToFileAsync(string fileName, string content, string baseFolder)
        {
            try
            {
                string filePath = Path.Combine(baseFolder, fileName);
                string directoryPath = Path.GetDirectoryName(filePath);

                if (!string.IsNullOrEmpty(directoryPath))
                {
                    Directory.CreateDirectory(directoryPath);
                }

                // Usiamo un FileStream in modalità Append per accodare i peer
                await using (var stream = new FileStream(filePath, FileMode.Append, FileAccess.Write, FileShare.Read))
                await using (var writer = new StreamWriter(stream))
                {
                    await writer.WriteAsync(content);
                    await writer.FlushAsync();

                    // Forziamo il sistema operativo (NTFS/WSL) a committare i dati su disco IMMEDIATAMENTE!
                    stream.Flush(flushToDisk: true);
                }

                // verifica di sicurezza per sincronizzazione WSL
                int retries = 5;
                while (retries > 0)
                {
                    var fileInfo = new FileInfo(filePath);
                    if (fileInfo.Exists && fileInfo.Length > 0)
                    {
                        break;
                    }

                    await Task.Delay(100);
                    retries--;
                }
            }
            catch (UnauthorizedAccessException ex)
            {
                throw new IOException("Permessi insufficienti per scrivere il file di configurazione.", ex);
            }
            catch (DirectoryNotFoundException ex)
            {
                throw new IOException("Directory di destinazione non trovata.", ex);
            }
            catch (IOException ex)
            {
                throw new IOException("Errore I/O durante la scrittura del file di configurazione.", ex);
            }
        }

        public async static Task DeleteFile(string fileName)
        {
            await DeleteFile(fileName, _baseFolderPath);
        }
       
        public async static Task DeleteFile(string fileName, string baseFolder)
        {
            try
            {
                string filePath = Path.Combine(baseFolder, fileName);
                if (File.Exists(filePath))
                {
                    File.Delete(filePath);
                }
            }
            catch (UnauthorizedAccessException ex)
            {
                throw new IOException("Permessi insufficienti per eliminare il file di configurazione.", ex);
            }
            catch (DirectoryNotFoundException ex)
            {
                throw new IOException("Directory di destinazione non trovata.", ex);
            }
            catch (IOException ex)
            {
                throw new IOException("Errore I/O durante l'eliminazione del file di configurazione.", ex);
            }
        }

        public static String SanitizeFileName(string fileName)
        {
            if (fileName == null) return "";

            string sanitizedFileName = fileName.Replace(" ", "_");

            foreach (char invalidChar in Path.GetInvalidFileNameChars())
            {
                sanitizedFileName = sanitizedFileName.Replace(invalidChar.ToString(), "");
            }

            return sanitizedFileName.ToLower();
        }


    }

}
