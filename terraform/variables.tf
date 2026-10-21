variable "aws_region" {
  type        = string
  description = "AWS region for the application stack."
  default     = "us-east-2"
}

variable "project" {
  type        = string
  description = "Short name used in resource names."
  default     = "food-fight"
}

variable "environment" {
  type        = string
  description = "Environment name used in resource names."
  default     = "prod"
}

variable "image_tag" {
  type        = string
  description = "ECR image tag to run. GitHub Actions sets this to the commit SHA."
}

variable "domain_name" {
  type        = string
  description = "Public hostname, such as foodfight.example.com. Leave empty to serve HTTP on the load balancer DNS name."
  default     = ""
}

variable "route53_zone_id" {
  type        = string
  description = "Route 53 hosted zone that contains domain_name. Required when domain_name is set."
  default     = ""
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance class."
  default     = "db.t4g.micro"
}

variable "db_deletion_protection" {
  type        = bool
  description = "Block Terraform from deleting the database."
  default     = true
}

variable "task_cpu" {
  type        = number
  description = "Fargate task CPU units. 256 is 0.25 vCPU."
  default     = 256
}

variable "task_memory" {
  type        = number
  description = "Fargate task memory in MiB."
  default     = 512
}

variable "google_auth_client_id" {
  type        = string
  description = "Optional Google OAuth client id."
  default     = ""
  sensitive   = true
}

variable "google_auth_client_secret" {
  type        = string
  description = "Optional Google OAuth client secret."
  default     = ""
  sensitive   = true
}

variable "gmail_address" {
  type        = string
  description = "Optional Gmail address for welcome email."
  default     = ""
  sensitive   = true
}

variable "gmail_password" {
  type        = string
  description = "Optional Gmail app password."
  default     = ""
  sensitive   = true
}

variable "yelp_api_key" {
  type        = string
  description = "Optional Yelp Fusion API key."
  default     = ""
  sensitive   = true
}

variable "mailjet_api_key" {
  type        = string
  description = "Optional Mailjet API key."
  default     = ""
  sensitive   = true
}

variable "mailjet_api_secret" {
  type        = string
  description = "Optional Mailjet API secret."
  default     = ""
  sensitive   = true
}
