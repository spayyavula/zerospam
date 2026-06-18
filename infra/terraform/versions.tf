terraform {
  required_version = ">= 1.10"

  backend "s3" {
    bucket       = "zerospam-tfstate-992382415038"
    key          = "zerospam/terraform.tfstate"
    region       = "us-east-1"
    profile      = "zerospam"
    encrypt      = true
    use_lockfile = true # S3-native state locking (no DynamoDB needed; TF >= 1.10)
  }

  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region  = var.region
  profile = "zerospam"
}
