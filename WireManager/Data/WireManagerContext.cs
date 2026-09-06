using Microsoft.EntityFrameworkCore;
using WireManager.Core.Models;

namespace WireManager.Core.Data
{
    public class WireManagerContext : DbContext
    {

        public DbSet<ConfServer> ConfServers { get; set; }
        public DbSet<ConfPeer> ConfPeers { get; set; }
        public DbSet<Users> Users { get; set; }
        public DbSet<Tag> Tags { get; set; }
        public DbSet<Service> Services { get; set; }
        public DbSet<PeerTag> PeerTags { get; set; }
        public DbSet<TagService> TagServices { get; set; }
        public DbSet<SystemConfig> SystemConfigs { get; set; }
        public DbSet<UsageHistory> UsageHistories { get; set; }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            // Stringa di connessione corretta per MySQL su Docker Desktop
            if (!optionsBuilder.IsConfigured)
            {
                string host = Environment.GetEnvironmentVariable("DB_HOST") ?? "localhost";
                string port = Environment.GetEnvironmentVariable("DB_PORT") ?? "3306";
                string db = Environment.GetEnvironmentVariable("DB_NAME") ?? "wiremanager";
                string user = Environment.GetEnvironmentVariable("DB_USER") ?? "wireadmin";
                string pass = Environment.GetEnvironmentVariable("DB_PASS") ?? "";

                string connectionString = $"Server={host};Port={port};Database={db};Uid={user};Pwd={pass};";

                optionsBuilder.UseMySQL(
                    connectionString,
                    b => b.MigrationsAssembly("WireManager.Core")
                );
            }
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<ConfPeer>()
                .HasOne(p => p.Server)                // Il peer ha un server di riferimento
                .WithMany(s => s.Peers)               // Il server ha una collezione di peer
                .HasForeignKey(p => p.ConfServerId)   // La proprietà che fa da Chiave Esterna
                .OnDelete(DeleteBehavior.Cascade);    // Se elimini un server, elimina in automatico tutti i suoi peer

            // Configurazione della tabella Users

            modelBuilder.Entity<Users>()
                .HasIndex(u => u.Username)
                .IsUnique();

            // Configurazione della relazione molti-a-molti tra ConfPeer e Tag e Service

            modelBuilder.Entity<PeerTag>()
                .HasKey(pt => new { pt.PeerId, pt.TagId });

            modelBuilder.Entity<PeerTag>()
                 .HasOne(pt => pt.Peer)
                 .WithMany(p => p.PeerTags)
                 .HasForeignKey(pt => pt.PeerId);

            modelBuilder.Entity<PeerTag>()
                 .HasOne(pt => pt.Tag)
                 .WithMany(t => t.PeerTags)
                 .HasForeignKey(pt => pt.TagId);

            modelBuilder.Entity<TagService>()
                .HasKey(ts => new { ts.TagId, ts.ServiceId });

            modelBuilder.Entity<TagService>()
                .HasOne(ts => ts.Tag)
                .WithMany(t => t.TagServices)
                .HasForeignKey(ts => ts.TagId);

            modelBuilder.Entity<TagService>()
                .HasOne(ts => ts.Service)
                .WithMany(s => s.TagServices)
                .HasForeignKey(ts => ts.ServiceId);

            modelBuilder.Entity<UsageHistory>(entity =>
            {
                entity.ToTable("UsageHistories");

                entity.HasKey(u => u.Id);

                // Relazione: un record di storico appartiene a un ConfPeer (tramite PublicKey)
                entity.HasOne(u => u.Peer)                 // Nome della proprietà di navigazione dentro UsageHistory (es. ConfPeer o Peer)
                      .WithMany(p => p.UsageHistories)        // Collezione dentro ConfPeer
                      .HasForeignKey(u => u.PublicKey)        // La Foreign Key in UsageHistory
                      .HasPrincipalKey(p => p.PublicKey)      // Specifica che punta a PublicKey anche se ConfPeer ha un altro Id come PK
                      .OnDelete(DeleteBehavior.Cascade);      // Se elimini il peer, cancella lo storico in automatico

                // Indice composito per rendere istantanee le query dei grafici
                entity.HasIndex(u => new { u.PublicKey, u.Timestamp });
            });

            modelBuilder.Entity<ConfPeer>()
                .Property(p => p.PersistentKeepAlive)
                .HasDefaultValue(0);

        }

    }
}
