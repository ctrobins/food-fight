resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "Public HTTP and HTTPS for the Food Fight load balancer"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name}-alb"
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from the internet"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from the internet"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_app" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward to the application"
  ip_protocol                  = "tcp"
  from_port                    = 3001
  to_port                      = 3001
  referenced_security_group_id = aws_security_group.ecs.id
}

resource "aws_security_group" "ecs" {
  name        = "${local.name}-ecs"
  description = "Food Fight tasks accept traffic only from the load balancer"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name}-ecs"
  }
}

resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id            = aws_security_group.ecs.id
  description                  = "Application port from the load balancer"
  ip_protocol                  = "tcp"
  from_port                    = 3001
  to_port                      = 3001
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_egress_rule" "ecs_all" {
  security_group_id = aws_security_group.ecs.id
  description       = "Database, image pulls, and outbound APIs"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_security_group" "rds" {
  name        = "${local.name}-rds"
  description = "Postgres accepts traffic only from Food Fight tasks"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${local.name}-rds"
  }
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs" {
  security_group_id            = aws_security_group.rds.id
  description                  = "Postgres from application tasks"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.ecs.id
}
