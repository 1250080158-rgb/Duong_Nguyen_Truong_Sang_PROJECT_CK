-- =====================================================================
-- MED-EQUIP — tạo CSDL riêng cho Keycloak, tách khỏi CSDL nghiệp vụ.
--
-- File này được PostgreSQL mount vào /docker-entrypoint-initdb.d và
-- chạy đúng một lần, ở lần khới tạo volume dữ liệu đầu tiên (sau
-- 01-QLTBYT.sql). Không chứa gì ngoài tạo CSDL: realm, người dùng và
-- vai trò của Keycloak nằm trong docker/keycloak/realm-medequip.json
-- và được Keycloak tự import khi khởi động.
-- =====================================================================

CREATE DATABASE keycloak OWNER sa ENCODING 'UTF8';
