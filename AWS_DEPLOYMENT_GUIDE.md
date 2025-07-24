# 🚀 AWS Deployment Guide for Sudoku Pro

This guide provides step-by-step instructions for deploying Sudoku Pro to AWS using various methods.

## 📋 Prerequisites

### Required Tools
- [AWS CLI](https://aws.amazon.com/cli/) (v2.x or later)
- [Docker](https://www.docker.com/) (v20.x or later)
- [Git](https://git-scm.com/) (for version control)

### AWS Account Setup
1. **Create AWS Account**: Sign up at [aws.amazon.com](https://aws.amazon.com/)
2. **Create IAM User**: Create a user with appropriate permissions
3. **Configure AWS CLI**: Run `aws configure` with your credentials
4. **Set Default Region**: Choose your preferred region (e.g., `us-east-1`)

### Required AWS Permissions
Your IAM user/role needs permissions for:
- ECR (Elastic Container Registry)
- ECS (Elastic Container Service)
- EC2 (for security groups and networking)
- CloudWatch (for logging)
- IAM (for service roles)
- Application Auto Scaling
- Secrets Manager (optional)

## 🎯 Deployment Methods

### Method 1: Automated Script (Recommended)

#### For Linux/macOS:
```bash
# Clone the repository
git clone <your-repo-url>
cd sudoko_light

# Make script executable
chmod +x aws-deploy.sh

# Run deployment
./aws-deploy.sh
```

#### For Windows:
```cmd
# Clone the repository
git clone <your-repo-url>
cd sudoko_light

# Run deployment
aws-deploy.bat
```

### Method 2: CloudFormation (Infrastructure as Code)

```bash
# Deploy infrastructure
aws cloudformation create-stack \
  --stack-name sudoku-pro \
  --template-body file://aws-cloudformation.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameters ParameterKey=DomainName,ParameterValue=yourdomain.com

# Wait for completion
aws cloudformation wait stack-create-complete --stack-name sudoku-pro

# Get outputs
aws cloudformation describe-stacks \
  --stack-name sudoku-pro \
  --query 'Stacks[0].Outputs'
```

### Method 3: Manual Step-by-Step

#### Step 1: Create ECR Repository
```bash
aws ecr create-repository --repository-name sudoku-pro --region us-east-1
```

#### Step 2: Build and Push Docker Image
```bash
# Get ECR login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t sudoku-pro .

# Tag image
docker tag sudoku-pro:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/sudoku-pro:latest

# Push to ECR
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/sudoku-pro:latest
```

#### Step 3: Create ECS Cluster
```bash
aws ecs create-cluster --cluster-name sudoku-cluster --region us-east-1
```

#### Step 4: Create Task Definition
```bash
# Create task-definition.json file (see template in aws-cloudformation.yml)
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

#### Step 5: Create ECS Service
```bash
aws ecs create-service \
  --cluster sudoku-cluster \
  --service-name sudoku-service \
  --task-definition sudoku-task:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-12345678,subnet-87654321],securityGroups=[sg-12345678],assignPublicIp=ENABLED}"
```

## 🔧 Configuration Options

### Environment Variables
```bash
# Production settings
FLASK_ENV=production
SECRET_KEY=your-secret-key-here
HOST=0.0.0.0
PORT=5000
DEBUG=False
```

### Resource Allocation
- **CPU**: 256 (0.25 vCPU) - suitable for most workloads
- **Memory**: 512 MB - sufficient for Sudoku game
- **Desired Count**: 2 - for high availability
- **Max Count**: 10 - for auto-scaling

### Auto Scaling Configuration
```bash
# Create auto scaling target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/sudoku-cluster/sudoku-service \
  --min-capacity 2 \
  --max-capacity 10

# Create scaling policy
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/sudoku-cluster/sudoku-service \
  --policy-name sudoku-cpu-policy \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{"TargetValue": 70.0, "PredefinedMetricSpecification": {"PredefinedMetricType": "ECSServiceAverageCPUUtilization"}}'
```

## 🔒 Security Configuration

### Security Groups
```bash
# Create security group
aws ec2 create-security-group \
  --group-name sudoku-sg \
  --description "Security group for Sudoku Pro"

# Add inbound rules
aws ec2 authorize-security-group-ingress \
  --group-id sg-12345678 \
  --protocol tcp \
  --port 5000 \
  --cidr 0.0.0.0/0
```

### SSL/HTTPS Setup
```bash
# Request SSL certificate
aws acm request-certificate \
  --domain-name yourdomain.com \
  --validation-method DNS

# Create HTTPS listener
aws elbv2 create-listener \
  --load-balancer-arn <alb-arn> \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=<certificate-arn> \
  --default-actions Type=forward,TargetGroupArn=<target-group-arn>
```

## 📊 Monitoring and Logging

### CloudWatch Dashboard
```bash
# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name SudokuMetrics \
  --dashboard-body '{
    "widgets": [
      {
        "type": "metric",
        "properties": {
          "metrics": [["AWS/ECS", "CPUUtilization", "ServiceName", "sudoku-service", "ClusterName", "sudoku-cluster"]],
          "period": 300,
          "stat": "Average",
          "region": "us-east-1",
          "title": "CPU Utilization"
        }
      }
    ]
  }'
```

### Log Management
```bash
# View logs
aws logs tail /ecs/sudoku-app --follow --region us-east-1

# Set log retention
aws logs put-retention-policy \
  --log-group-name /ecs/sudoku-app \
  --retention-in-days 30
```

## 🌐 Custom Domain Setup

### Route 53 Configuration
```bash
# Create hosted zone
aws route53 create-hosted-zone \
  --name yourdomain.com \
  --caller-reference $(date +%s)

# Create A record
aws route53 change-resource-record-sets \
  --hosted-zone-id <zone-id> \
  --change-batch '{
    "Changes": [
      {
        "Action": "CREATE",
        "ResourceRecordSet": {
          "Name": "sudoku.yourdomain.com",
          "Type": "A",
          "AliasTarget": {
            "HostedZoneId": "<alb-zone-id>",
            "DNSName": "<alb-dns-name>",
            "EvaluateTargetHealth": true
          }
        }
      }
    ]
  }'
```

## 💰 Cost Optimization

### Estimated Monthly Costs (us-east-1)
- **ECS Fargate**: ~$15-30/month (2 tasks, 256 CPU, 512 MB)
- **ECR**: ~$1-5/month (storage and data transfer)
- **CloudWatch**: ~$2-10/month (logs and metrics)
- **Application Load Balancer**: ~$20-30/month
- **Data Transfer**: ~$5-15/month

**Total**: ~$45-90/month

### Cost Reduction Tips
1. **Use Spot Instances**: For non-critical workloads
2. **Optimize Container Size**: Reduce image size
3. **Set Log Retention**: Keep logs for shorter periods
4. **Use Reserved Capacity**: For predictable workloads
5. **Monitor Usage**: Set up billing alerts

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Deploy to AWS ECS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build, tag, and push image to Amazon ECR
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: sudoku-pro
          IMAGE_TAG: latest
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster sudoku-cluster --service sudoku-service --force-new-deployment
```

## 🚨 Troubleshooting

### Common Issues

#### 1. ECS Service Not Starting
```bash
# Check service events
aws ecs describe-services \
  --cluster sudoku-cluster \
  --services sudoku-service

# Check task logs
aws logs tail /ecs/sudoku-app --follow
```

#### 2. Container Health Check Failing
```bash
# Verify health endpoint
curl -f http://localhost:5000/health

# Check container logs
aws logs get-log-events \
  --log-group-name /ecs/sudoku-app \
  --log-stream-name <stream-name>
```

#### 3. Security Group Issues
```bash
# Verify security group rules
aws ec2 describe-security-groups \
  --group-ids sg-12345678

# Test connectivity
telnet <public-ip> 5000
```

#### 4. ECR Authentication Issues
```bash
# Re-authenticate with ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
```

### Performance Optimization

#### 1. Container Optimization
```dockerfile
# Use multi-stage builds
FROM python:3.11-slim as builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user -r requirements.txt

FROM python:3.11-slim
COPY --from=builder /root/.local /root/.local
# ... rest of Dockerfile
```

#### 2. Application Optimization
- Enable gzip compression
- Use CDN for static assets
- Implement caching headers
- Optimize database queries

## 📞 Support

### AWS Support
- **Basic Support**: Included with AWS account
- **Developer Support**: $29/month
- **Business Support**: $100/month
- **Enterprise Support**: $15,000/month

### Community Resources
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS ECR Documentation](https://docs.aws.amazon.com/ecr/)
- [AWS CloudFormation Documentation](https://docs.aws.amazon.com/cloudformation/)

### Monitoring Tools
- **AWS CloudWatch**: Built-in monitoring
- **AWS X-Ray**: Distributed tracing
- **AWS CloudTrail**: API logging
- **AWS Config**: Configuration management

---

## 🎉 Success!

Your Sudoku Pro game is now running on AWS with:
- ✅ High availability (2+ instances)
- ✅ Auto-scaling capabilities
- ✅ Load balancing
- ✅ SSL/HTTPS support
- ✅ Comprehensive monitoring
- ✅ Cost optimization
- ✅ Security best practices

Enjoy your production-ready Sudoku game! 🧩 