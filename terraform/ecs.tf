resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = 14
}

resource "aws_ecs_cluster" "app" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

resource "aws_ecs_task_definition" "app" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "app"
      image     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
      essential = true
      portMappings = [
        {
          containerPort = 3001
          hostPort      = 3001
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3001" },
        { name = "TRUST_PROXY", value = "true" },
        { name = "COOKIE_SECURE", value = local.https_enabled ? "true" : "false" },
        { name = "DOMAIN", value = local.app_domain },
        { name = "DB_HOST", value = aws_db_instance.app.address },
        { name = "DB_PORT", value = "5432" },
        { name = "DB_NAME", value = "foodfight" },
        { name = "DB_USER", value = "foodfight" },
        { name = "DB_SSL", value = "true" },
        { name = "CONFIG_VERSION", value = aws_secretsmanager_secret_version.app.version_id },
      ]
      secrets = [
        for key in local.secret_keys : {
          name      = key
          valueFrom = "${aws_secretsmanager_secret.app.arn}:${key}::"
        }
      ]
      healthCheck = {
        command     = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:3001/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 40
      }
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.app.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "app"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "app" {
  name                               = var.project
  cluster                            = aws_ecs_cluster.app.id
  task_definition                    = aws_ecs_task_definition.app.arn
  desired_count                      = 1
  launch_type                        = "FARGATE"
  platform_version                   = "LATEST"
  health_check_grace_period_seconds  = 120
  wait_for_steady_state              = true
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 3001
  }

  depends_on = [
    aws_lb_listener.http_forward,
    aws_lb_listener.http_redirect,
    aws_lb_listener.https,
  ]
}
