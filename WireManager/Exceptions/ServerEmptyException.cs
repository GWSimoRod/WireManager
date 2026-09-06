namespace WireManager.Core.Exceptions
{
    internal class ServerEmptyException : Exception
    {
        public ServerEmptyException() { }

        public ServerEmptyException(String e) : base(e) { }

    }
}
