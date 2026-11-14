using System.Text;
using MedEquip.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MedEquip.Infrastructure;

public class DataContext : DbContext
{
    public DataContext(DbContextOptions<DataContext> options) : base(options) { }

    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Manufacturer> Manufacturers => Set<Manufacturer>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<EquipmentModel> EquipmentModels => Set<EquipmentModel>();
    public DbSet<Equipment> Equipment => Set<Equipment>();
    public DbSet<EquipmentStatusHistory> EquipmentStatusHistory => Set<EquipmentStatusHistory>();
    public DbSet<User> Users => Set<User>();
    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();
    public DbSet<WorkOrderStep> WorkOrderSteps => Set<WorkOrderStep>();
    public DbSet<RequiredEvidenceConfig> RequiredEvidenceConfig => Set<RequiredEvidenceConfig>();
    public DbSet<Evidence> Evidence => Set<Evidence>();
    public DbSet<Incident> Incidents => Set<Incident>();
    public DbSet<Assignment> Assignments => Set<Assignment>();
    public DbSet<AuditLog> AuditLog => Set<AuditLog>();
    public DbSet<SystemConfig> SystemConfig => Set<SystemConfig>();
    public DbSet<Notification> Notifications => Set<Notification>();

    // Mọi cột thời gian trong QLTBYT.sql đều là TIMESTAMPTZ, mà Npgsql chỉ
    // nhận DateTime có Kind = Utc. Nếu lỡ tay gán DateTime.Now (Kind = Local)
    // thì sẽ ném ArgumentException lúc SaveChanges. Hai override dưới đây
    // tự động quy đổi về UTC trước khi ghi, để code ghi tiếp không phải
    // nhớ quy tắc này ở từng chỗ.
    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        NormalizeDateTimeToUtc();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default)
    {
        NormalizeDateTimeToUtc();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void NormalizeDateTimeToUtc()
    {
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified)) continue;

            foreach (var property in entry.Properties)
            {
                if (property.CurrentValue is DateTime value && value.Kind == DateTimeKind.Local)
                {
                    property.CurrentValue = value.ToUniversalTime();
                }
            }
        }
    }

    protected override void OnModelCreating(ModelBuilder mb)
    {
        // ---- Quy ước snake_case khớp 1:1 với database/QLTBYT.sql ----
        foreach (var entityType in mb.Model.GetEntityTypes())
        {
            foreach (var prop in entityType.GetProperties())
            {
                prop.SetColumnName(ToSnake(prop.GetColumnName()));
            }
        }

        // ---- Khai báo khoá chính tường minh ----
        // EF chỉ tự nhận khoá khi tên cột là "Id" hoặc "<TênLớp>Id".
        // Nhiều bảng đặt tên khoá theo nghiệp vụ (ModelId, AuditId, ConfigKey...)
        // nên phải chỉ định tay, nếu không EF báo lỗi "requires a primary key".
        mb.Entity<Department>().HasKey(e => e.IdKhoa);
        mb.Entity<Manufacturer>().HasKey(m => m.IdHang);
        mb.Entity<Supplier>().HasKey(s => s.IdNcc);
        mb.Entity<EquipmentModel>().HasKey(m => m.IdModel);
        mb.Entity<Equipment>().HasKey(e => e.IdThietBi);
        mb.Entity<EquipmentStatusHistory>().HasKey(h => h.IdLichSu);
        mb.Entity<User>().HasKey(u => u.IdNguoiDung);
        mb.Entity<WorkOrder>().HasKey(w => w.IdPhieu);
        mb.Entity<WorkOrderStep>().HasKey(s => s.IdBuoc);
        mb.Entity<RequiredEvidenceConfig>().HasKey(c => c.ConfigId);
        mb.Entity<Evidence>().HasKey(e => e.IdBangChung);
        mb.Entity<Incident>().HasKey(i => i.IdSuCo);
        mb.Entity<Assignment>().HasKey(a => a.IdPhanCong);
        mb.Entity<AuditLog>().HasKey(a => a.IdKiemToan);
        mb.Entity<SystemConfig>().HasKey(c => c.ConfigKey);      // khoá là chuỗi, không phải số
        mb.Entity<Notification>().HasKey(n => n.NotificationId);

        // ---- Cột sinh tự động do CSDL quản lý (GENERATED AS IDENTITY) ----
        mb.Entity<Department>().Property(e => e.IdKhoa).ValueGeneratedOnAdd();
        mb.Entity<Manufacturer>().Property(m => m.IdHang).ValueGeneratedOnAdd();
        mb.Entity<Supplier>().Property(s => s.IdNcc).ValueGeneratedOnAdd();
        mb.Entity<EquipmentModel>().Property(m => m.IdModel).ValueGeneratedOnAdd();
        mb.Entity<Equipment>().Property(e => e.IdThietBi).ValueGeneratedOnAdd();
        mb.Entity<EquipmentStatusHistory>().Property(h => h.IdLichSu).ValueGeneratedOnAdd();
        mb.Entity<User>().HasIndex(u => u.TenDangNhap).IsUnique();
        mb.Entity<WorkOrder>().HasIndex(w => w.Ma).IsUnique();
        mb.Entity<WorkOrderStep>().HasIndex(s => new { s.IdPhieu, s.ThuTu }).IsUnique();
        mb.Entity<Incident>().HasIndex(i => i.Ma).IsUnique();
        mb.Entity<Assignment>().HasIndex(a => a.IdPhieu).IsUnique();
        mb.Entity<RequiredEvidenceConfig>()
            .HasIndex(c => new { c.OrderType, c.EvidenceCode }).IsUnique();
        mb.Entity<Notification>().Property(n => n.NotificationId).ValueGeneratedOnAdd();

        // ---- Quan hệ khóa ngoại: chỉ định cột thật trong CSDL ----
        // Để EF tự sinh shadow FK, nó đặt tên theo tên navigation
        // (Incident.Reporter -> reporter_user_id) chứ không phải cột
        // bao_boi trong QLTBYT.sql. Ràng buộc HasForeignKey cho nó dùng
        // lại đúng thuộc tính khóa ngoại đã khai báo; tên cột bao_boi /
        // performed_by do vòng lặp snake_case đặt sẵn ở trên.
        mb.Entity<Incident>()
            .HasOne(i => i.Reporter).WithMany()
            .HasForeignKey(i => i.BaoBoi);

        mb.Entity<WorkOrderStep>()
            .HasOne(s => s.Operator).WithMany()
            .HasForeignKey(s => s.PerformedBy);

        // Evidence.Uploader cũng dính lỗi tương tự: nếu bỏ qua, EF sinh
        // shadow FK tên uploader_user_id và màn chi tiết phiếu trả 500 với
        // "column e1.uploader_user_id does not exist".
        mb.Entity<Evidence>()
            .HasOne(e => e.Uploader).WithMany()
            .HasForeignKey(e => e.TaiBoi);

        // ---- Toàn bộ quan hệ còn lại cũng phải khai báo tường minh ----
        // Các entity dùng tên khóa ngoại tiếng Việt (IdKhoa, IdThietBi,
        // IdNguoiThucHien...). EF chỉ tự dò FK theo tên kiểu "<nav>Id",
        // nên tập property này không được nhận diện → sinh shadow FK với
        // tên ngẫu hứng (DepartmentIdKhoa, MaintenanceSupplierIdNcc,
        // AssigneeIdNguoiDung...) mà QLTBYT.sql không có → mỗi lệnh đọc
        // trả 500 "column ... does not exist". Khai báo tay để EF bị ép
        // dùng đúng cột đã khai trong CSDL.
        mb.Entity<EquipmentModel>()
            .HasOne(m => m.Manufacturer).WithMany()
            .HasForeignKey(m => m.IdHang);

        mb.Entity<Equipment>()
            .HasOne(e => e.Model).WithMany(m => m.Equipments)
            .HasForeignKey(e => e.IdModel);

        mb.Entity<Equipment>()
            .HasOne(e => e.Department).WithMany(d => d.Equipments)
            .HasForeignKey(e => e.IdKhoa);

        mb.Entity<Equipment>()
            .HasOne(e => e.MaintenanceSupplier).WithMany()
            .HasForeignKey(e => e.IdNccBaoTri);

        mb.Entity<EquipmentStatusHistory>()
            .HasOne(h => h.Equipment).WithMany()
            .HasForeignKey(h => h.IdThietBi);

        mb.Entity<User>()
            .HasOne(u => u.Department).WithMany(d => d.Users)
            .HasForeignKey(u => u.IdKhoa);

        mb.Entity<WorkOrder>()
            .HasOne(w => w.Equipment).WithMany(e => e.WorkOrders)
            .HasForeignKey(w => w.IdThietBi);

        mb.Entity<WorkOrder>()
            .HasOne(w => w.Department).WithMany()
            .HasForeignKey(w => w.IdKhoa);

        mb.Entity<WorkOrder>()
            .HasOne(w => w.Assignee).WithMany()
            .HasForeignKey(w => w.IdNguoiThucHien);

        mb.Entity<WorkOrderStep>()
            .HasOne(s => s.WorkOrder).WithMany(w => w.Steps)
            .HasForeignKey(s => s.IdPhieu);

        mb.Entity<Evidence>()
            .HasOne(e => e.WorkOrder).WithMany(w => w.Evidence)
            .HasForeignKey(e => e.IdPhieu);

        mb.Entity<Incident>()
            .HasOne(i => i.Equipment).WithMany()
            .HasForeignKey(i => i.IdThietBi);

        mb.Entity<Assignment>()
            .HasOne(a => a.WorkOrder).WithMany()
            .HasForeignKey(a => a.IdPhieu);

        mb.Entity<Assignment>()
            .HasOne(a => a.Equipment).WithMany()
            .HasForeignKey(a => a.IdThietBi);

        mb.Entity<Assignment>()
            .HasOne(a => a.Assignee).WithMany()
            .HasForeignKey(a => a.IdNguoiDung);

        mb.Entity<Notification>()
            .HasOne(n => n.User).WithMany()
            .HasForeignKey(n => n.UserId);

        // ---- Cột số thập phân: chống mất chữ số 0 ----
        mb.Entity<WorkOrderStep>().Property(s => s.GiaTriChuan).HasPrecision(10, 4);
        mb.Entity<WorkOrderStep>().Property(s => s.GiaTriDo).HasPrecision(10, 4);
        mb.Entity<WorkOrderStep>().Property(s => s.DungSaiPhanTram).HasPrecision(5, 2);
        mb.Entity<EquipmentModel>().Property(m => m.DungSaiHcPhanTram).HasPrecision(5, 2);
        mb.Entity<Equipment>().Property(e => e.GiaMua).HasPrecision(14, 2);
    }

    static string ToSnake(string? name)
    {
        if (string.IsNullOrEmpty(name)) return name ?? "";
        var sb = new StringBuilder();
        foreach (var c in name)
        {
            if (char.IsUpper(c) && sb.Length > 0) sb.Append('_');
            sb.Append(char.ToLowerInvariant(c));
        }
        return sb.ToString();
    }
}
