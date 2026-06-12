variable "region" {
  type    = string
  default = "us-east-1"
}

variable "domain" {
  type    = string
  default = "zero-spam.email"
}

variable "instance_type" {
  type    = string
  default = "t4g.small" # ARM
}

variable "ssh_ingress_cidr" {
  description = "CIDR allowed to SSH (your IP/32)."
  type        = string
}

variable "key_name" {
  description = "Existing EC2 key pair name for SSH."
  type        = string
}

variable "repo_url" {
  description = "Git URL the instance clones to /opt/zerospam (https with token or public)."
  type        = string
}

variable "deploy_branch" {
  description = "Branch the instance checks out and deploys (the deploy files live here until merged to the default branch)."
  type        = string
  default     = "master"
}

variable "data_volume_gb" {
  type    = number
  default = 20
}
