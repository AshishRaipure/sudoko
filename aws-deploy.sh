#!/bin/bash

# AWS ECS Deployment Script for Sudoku Pro
set -e

# Configuration
REGION="us-east-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO_NAME="sudoku-pro"
CLUSTER_NAME="sudoku-cluster"
SERVICE_NAME="sudoku-service"
TASK_FAMILY="sudoku-task"

echo "🚀 Starting AWS ECS deployment for Sudoku Pro..."

# Check prerequisites
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install AWS CLI first."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ Prerequisites check passed"
echo "📊 Account ID: $ACCOUNT_ID"
echo "🌍 Region: $REGION"

# 1. Create ECR repository if it doesn't exist
echo "📦 Creating ECR repository..."
aws ecr describe-repositories --repository-names $ECR_REPO_NAME --region $REGION 2>/dev/null || \
aws ecr create-repository --repository-name $ECR_REPO_NAME --region $REGION

ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO_NAME"

# 2. Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_URI

# 3. Build and push Docker image
echo "🔨 Building Docker image..."
docker build -t $ECR_REPO_NAME .

echo "🏷️ Tagging image..."
docker tag $ECR_REPO_NAME:latest $ECR_URI:latest

echo "📤 Pushing image to ECR..."
docker push $ECR_URI:latest

# 4. Create ECS cluster if it doesn't exist
echo "🏗️ Creating ECS cluster..."
aws ecs describe-clusters --clusters $CLUSTER_NAME --region $REGION 2>/dev/null || \
aws ecs create-cluster --cluster-name $CLUSTER_NAME --region $REGION

# 5. Create task definition
echo "📋 Creating task definition..."
cat > task-definition.json << EOF
{
  "family": "$TASK_FAMILY",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::$ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "sudoku-app",
      "image": "$ECR_URI:latest",
      "portMappings": [
        {
          "containerPort": 5000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "FLASK_ENV",
          "value": "production"
        },
        {
          "name": "SECRET_KEY",
          "value": "$(openssl rand -hex 32)"
        },
        {
          "name": "HOST",
          "value": "0.0.0.0"
        },
        {
          "name": "PORT",
          "value": "5000"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/sudoku-app",
          "awslogs-region": "$REGION",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:5000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF

# Register task definition
TASK_DEFINITION_ARN=$(aws ecs register-task-definition --cli-input-json file://task-definition.json --region $REGION --query 'taskDefinition.taskDefinitionArn' --output text)

echo "✅ Task definition registered: $TASK_DEFINITION_ARN"

# 6. Create CloudWatch log group
echo "📝 Creating CloudWatch log group..."
aws logs create-log-group --log-group-name "/ecs/sudoku-app" --region $REGION 2>/dev/null || true

# 7. Create security group if it doesn't exist
echo "🔒 Creating security group..."
SG_NAME="sudoku-sg"
SG_ID=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$SG_NAME" --query 'SecurityGroups[0].GroupId' --output text --region $REGION 2>/dev/null || echo "none")

if [ "$SG_ID" == "none" ] || [ "$SG_ID" == "None" ]; then
    VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query 'Vpcs[0].VpcId' --output text --region $REGION)
    SG_ID=$(aws ec2 create-security-group --group-name $SG_NAME --description "Security group for Sudoku Pro" --vpc-id $VPC_ID --region $REGION --query 'GroupId' --output text)
    
    # Add inbound rules
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 5000 --cidr 0.0.0.0/0 --region $REGION
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0 --region $REGION
    aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0 --region $REGION
fi

echo "✅ Security group: $SG_ID"

# 8. Get subnets
echo "🌐 Getting subnets..."
SUBNETS=$(aws ec2 describe-subnets --filters "Name=state,Values=available" --query 'Subnets[0:2].SubnetId' --output text --region $REGION)
SUBNET_ARRAY=($SUBNETS)

if [ ${#SUBNET_ARRAY[@]} -lt 2 ]; then
    echo "❌ Need at least 2 subnets for high availability"
    exit 1
fi

echo "✅ Using subnets: ${SUBNET_ARRAY[0]}, ${SUBNET_ARRAY[1]}"

# 9. Create or update service
echo "🚀 Creating ECS service..."
if aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $REGION &> /dev/null; then
    echo "📝 Updating existing service..."
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --task-definition $TASK_FAMILY \
        --region $REGION
else
    echo "🆕 Creating new service..."
    aws ecs create-service \
        --cluster $CLUSTER_NAME \
        --service-name $SERVICE_NAME \
        --task-definition $TASK_FAMILY \
        --desired-count 2 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_ARRAY[0]},${SUBNET_ARRAY[1]}],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
        --region $REGION
fi

# 10. Wait for service to be stable
echo "⏳ Waiting for service to be stable..."
aws ecs wait services-stable \
    --cluster $CLUSTER_NAME \
    --services $SERVICE_NAME \
    --region $REGION

# 11. Get service URL
echo "🌐 Getting service URL..."
TASK_ARN=$(aws ecs list-tasks --cluster $CLUSTER_NAME --service-name $SERVICE_NAME --region $REGION --query 'taskArns[0]' --output text)
ENI_ID=$(aws ecs describe-tasks --cluster $CLUSTER_NAME --tasks $TASK_ARN --region $REGION --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text)
PUBLIC_IP=$(aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID --region $REGION --query 'NetworkInterfaces[0].Association.PublicIp' --output text)

echo "✅ Deployment successful!"
echo "🌐 Your Sudoku Pro game is running at: http://$PUBLIC_IP:5000"
echo "📊 Health check: http://$PUBLIC_IP:5000/health"
echo "📝 View logs: aws logs tail /ecs/sudoku-app --follow --region $REGION"

# Cleanup
rm -f task-definition.json

echo ""
echo "🎮 Enjoy your production Sudoku Pro game!"
echo "📋 Next steps:"
echo "   - Set up a custom domain with Route 53"
echo "   - Configure SSL certificate with ACM"
echo "   - Set up Application Load Balancer for better scaling"
echo "   - Configure auto-scaling policies" 