data "aws_rds_engine_version" "postgres16" {
  engine  = "postgres"
  version = "16"
  latest  = true
}

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "app" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = local.name
  }
}

resource "aws_db_instance" "app" {
  identifier     = local.name
  engine         = "postgres"
  engine_version = data.aws_rds_engine_version.postgres16.version
  instance_class = var.db_instance_class

  db_name  = "foodfight"
  username = "foodfight"
  password = random_password.db.result

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.app.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period   = 7
  copy_tags_to_snapshot     = true
  deletion_protection       = var.db_deletion_protection
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name}-final"

  auto_minor_version_upgrade = true
  apply_immediately          = true

  tags = {
    Name = local.name
  }
}
