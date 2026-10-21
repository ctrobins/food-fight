variable "aws_region" {
  type        = string
  description = "Region for the state bucket and lock table. The application stack uses this same region."
  default     = "us-east-2"
}

variable "github_repository" {
  type        = string
  description = "GitHub repository allowed to assume the deploy role, as owner/name."
  default     = "ctrobins/food-fight"
}
