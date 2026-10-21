output "app_url" {
  description = "Public URL of the application."
  value       = trimsuffix(local.app_domain, "/")
}

output "alb_dns_name" {
  description = "Load balancer DNS name."
  value       = aws_lb.app.dns_name
}

output "ecr_repository_url" {
  description = "ECR repository URL, without a tag."
  value       = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.app.name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = aws_ecs_service.app.name
}

output "rds_endpoint" {
  description = "Postgres hostname."
  value       = aws_db_instance.app.address
}
