-- Ejecutar conectado como root/admin de MySQL.
-- Cambia la base, usuario y clave antes de correrlo.

CREATE USER IF NOT EXISTS 'gstore_app'@'%' IDENTIFIED BY 'CAMBIA_ESTA_CLAVE_LARGA';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
ON railway.*
TO 'gstore_app'@'%';

FLUSH PRIVILEGES;

-- Luego cambia MYSQL_URL en Railway a:
-- mysql://gstore_app:CAMBIA_ESTA_CLAVE_LARGA@HOST:PUERTO/railway
