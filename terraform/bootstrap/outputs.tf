output "aws_region" {
  value = var.aws_region
}

output "state_bucket" {
  value = aws_s3_bucket.state.bucket
}

output "lock_table" {
  value = aws_dynamodb_table.locks.name
}

output "deploy_role_arn" {
  value = aws_iam_role.deploy.arn
}

output "github_repository" {
  value = var.github_repository
}
