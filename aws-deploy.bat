@echo off
setlocal enabledelayedexpansion

REM AWS ECS Deployment Script for Sudoku Pro (Windows)
echo 🚀 Starting AWS ECS deployment for Sudoku Pro...

REM Configuration
set REGION=us-east-1
for /f "tokens=*" %%i in ('aws sts get-caller-identity --query Account --output text') do set ACCOUNT_ID=%%i
set ECR_REPO_NAME=sudoku-pro
set CLUSTER_NAME=sudoku-cluster
set SERVICE_NAME=sudoku-service
set TASK_FAMILY=sudoku-task

REM Check prerequisites
where aws >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ AWS CLI is not installed. Please install AWS CLI first.
    exit /b 1
)

where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker first.
    exit /b 1
)

REM Check AWS credentials
aws sts get-caller-identity >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ AWS credentials not configured. Please run 'aws configure' first.
    exit /b 1
)

echo ✅ Prerequisites check passed
echo 📊 Account ID: %ACCOUNT_ID%
echo 🌍 Region: %REGION%

REM 1. Create ECR repository if it doesn't exist
echo 📦 Creating ECR repository...
aws ecr describe-repositories --repository-names %ECR_REPO_NAME% --region %REGION% >nul 2>nul || (
    aws ecr create-repository --repository-name %ECR_REPO_NAME% --region %REGION%
)

set ECR_URI=%ACCOUNT_ID%.dkr.ecr.%REGION%.amazonaws.com/%ECR_REPO_NAME%

REM 2. Login to ECR
echo 🔐 Logging into ECR...
aws ecr get-login-password --region %REGION% | docker login --username AWS --password-stdin %ECR_URI%

REM 3. Build and push Docker image
echo 🔨 Building Docker image...
docker build -t %ECR_REPO_NAME% .

echo 🏷️ Tagging image...
docker tag %ECR_REPO_NAME%:latest %ECR_URI%:latest

echo 📤 Pushing image to ECR...
docker push %ECR_URI%:latest

REM 4. Create ECS cluster if it doesn't exist
echo 🏗️ Creating ECS cluster...
aws ecs describe-clusters --clusters %CLUSTER_NAME% --region %REGION% >nul 2>nul || (
    aws ecs create-cluster --cluster-name %CLUSTER_NAME% --region %REGION%
)

REM 5. Create CloudWatch log group
echo 📝 Creating CloudWatch log group...
aws logs create-log-group --log-group-name "/ecs/sudoku-app" --region %REGION% >nul 2>nul || echo Log group already exists

REM 6. Create security group if it doesn't exist
echo 🔒 Creating security group...
for /f "tokens=*" %%i in ('aws ec2 describe-security-groups --filters "Name=group-name,Values=sudoku-sg" --query "SecurityGroups[0].GroupId" --output text --region %REGION% 2^>nul') do set SG_ID=%%i

if "%SG_ID%"=="None" (
    for /f "tokens=*" %%i in ('aws ec2 describe-vpcs --filters "Name=is-default,Values=true" --query "Vpcs[0].VpcId" --output text --region %REGION%') do set VPC_ID=%%i
    for /f "tokens=*" %%i in ('aws ec2 create-security-group --group-name sudoku-sg --description "Security group for Sudoku Pro" --vpc-id %VPC_ID% --region %REGION% --query "GroupId" --output text') do set SG_ID=%%i
    
    REM Add inbound rules
    aws ec2 authorize-security-group-ingress --group-id %SG_ID% --protocol tcp --port 5000 --cidr 0.0.0.0/0 --region %REGION%
    aws ec2 authorize-security-group-ingress --group-id %SG_ID% --protocol tcp --port 80 --cidr 0.0.0.0/0 --region %REGION%
    aws ec2 authorize-security-group-ingress --group-id %SG_ID% --protocol tcp --port 443 --cidr 0.0.0.0/0 --region %REGION%
)

echo ✅ Security group: %SG_ID%

REM 7. Get subnets
echo 🌐 Getting subnets...
for /f "tokens=1,2" %%a in ('aws ec2 describe-subnets --filters "Name=state,Values=available" --query "Subnets[0:2].SubnetId" --output text --region %REGION%') do (
    set SUBNET1=%%a
    set SUBNET2=%%b
)

echo ✅ Using subnets: %SUBNET1%, %SUBNET2%

REM 8. Create task definition JSON
echo 📋 Creating task definition...
(
echo {
echo   "family": "%TASK_FAMILY%",
echo   "networkMode": "awsvpc",
echo   "requiresCompatibilities": ["FARGATE"],
echo   "cpu": "256",
echo   "memory": "512",
echo   "executionRoleArn": "arn:aws:iam::%ACCOUNT_ID%:role/ecsTaskExecutionRole",
echo   "containerDefinitions": [
echo     {
echo       "name": "sudoku-app",
echo       "image": "%ECR_URI%:latest",
echo       "portMappings": [
echo         {
echo           "containerPort": 5000,
echo           "protocol": "tcp"
echo         }
echo       ],
echo       "environment": [
echo         {
echo           "name": "FLASK_ENV",
echo           "value": "production"
echo         },
echo         {
echo           "name": "SECRET_KEY",
echo           "value": "your-secret-key-here"
echo         },
echo         {
echo           "name": "HOST",
echo           "value": "0.0.0.0"
echo         },
echo         {
echo           "name": "PORT",
echo           "value": "5000"
echo         }
echo       ],
echo       "logConfiguration": {
echo         "logDriver": "awslogs",
echo         "options": {
echo           "awslogs-group": "/ecs/sudoku-app",
echo           "awslogs-region": "%REGION%",
echo           "awslogs-stream-prefix": "ecs"
echo         }
echo       }
echo     }
echo   ]
echo }
) > task-definition.json

REM Register task definition
for /f "tokens=*" %%i in ('aws ecs register-task-definition --cli-input-json file://task-definition.json --region %REGION% --query "taskDefinition.taskDefinitionArn" --output text') do set TASK_DEFINITION_ARN=%%i

echo ✅ Task definition registered: %TASK_DEFINITION_ARN%

REM 9. Create or update service
echo 🚀 Creating ECS service...
aws ecs describe-services --cluster %CLUSTER_NAME% --services %SERVICE_NAME% --region %REGION% >nul 2>nul
if %errorlevel% equ 0 (
    echo 📝 Updating existing service...
    aws ecs update-service --cluster %CLUSTER_NAME% --service %SERVICE_NAME% --task-definition %TASK_FAMILY% --region %REGION%
) else (
    echo 🆕 Creating new service...
    aws ecs create-service --cluster %CLUSTER_NAME% --service-name %SERVICE_NAME% --task-definition %TASK_FAMILY% --desired-count 2 --launch-type FARGATE --network-configuration "awsvpcConfiguration={subnets=[%SUBNET1%,%SUBNET2%],securityGroups=[%SG_ID%],assignPublicIp=ENABLED}" --region %REGION%
)

REM 10. Wait for service to be stable
echo ⏳ Waiting for service to be stable...
aws ecs wait services-stable --cluster %CLUSTER_NAME% --services %SERVICE_NAME% --region %REGION%

REM 11. Get service URL
echo 🌐 Getting service URL...
for /f "tokens=*" %%i in ('aws ecs list-tasks --cluster %CLUSTER_NAME% --service-name %SERVICE_NAME% --region %REGION% --query "taskArns[0]" --output text') do set TASK_ARN=%%i
for /f "tokens=*" %%i in ('aws ecs describe-tasks --cluster %CLUSTER_NAME% --tasks %TASK_ARN% --region %REGION% --query "tasks[0].attachments[0].details[?name==`networkInterfaceId`].value" --output text') do set ENI_ID=%%i
for /f "tokens=*" %%i in ('aws ec2 describe-network-interfaces --network-interface-ids %ENI_ID% --region %REGION% --query "NetworkInterfaces[0].Association.PublicIp" --output text') do set PUBLIC_IP=%%i

echo ✅ Deployment successful!
echo 🌐 Your Sudoku Pro game is running at: http://%PUBLIC_IP%:5000
echo 📊 Health check: http://%PUBLIC_IP%:5000/health
echo 📝 View logs: aws logs tail /ecs/sudoku-app --follow --region %REGION%

REM Cleanup
del task-definition.json

echo.
echo 🎮 Enjoy your production Sudoku Pro game!
echo 📋 Next steps:
echo    - Set up a custom domain with Route 53
echo    - Configure SSL certificate with ACM
echo    - Set up Application Load Balancer for better scaling
echo    - Configure auto-scaling policies

pause 