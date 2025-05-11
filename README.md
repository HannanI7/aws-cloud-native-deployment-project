
![arch](/images/beanstalk-workshop-arch.png) 

_# Cloud-Based Web Application Deployment on AWS

**Group Members:**
*   [Ruhail Rizwan 21i-2462]
*   [Hannan Irfan 21K-4394]

**Course:** [Cloud Computing]
**Instructor:** [Dr. Qaisar Ali]


## Project Overview

This project demonstrates the deployment of a full-stack, cloud-native web application on AWS infrastructure. The application consists of a React frontend and a Node.js (Express.js) backend, utilizing various AWS services for compute, database, storage, networking, and security. The deployment follows modern cloud-native principles, including containerization with Docker and infrastructure provisioning with AWS CDK.

The application allows users to register, log in, manage their profiles (including profile picture uploads), and perform CRUD (Create, Read, Update, Delete) operations on [Your Primary Entity, e.g., "Tasks"].

**Technologies Used:**
*   **Frontend:** React.js
*   **Backend:** Node.js, Express.js
*   **Database:** Amazon DynamoDB
*   **File Storage:** Amazon S3
*   **Containerization:** Docker
*   **Infrastructure as Code (Partial):** AWS CDK (for DynamoDB, ECR, some IAM roles)
*   **Compute (Frontend):** AWS Elastic Beanstalk
*   **Compute (Backend):** Amazon EC2
*   **Networking:** Amazon VPC, Security Groups
*   **Identity & Access Management:** AWS IAM (Roles and Policies)
*   **Container Registry:** Amazon ECR

---

## Live Demo URLs

*   **Frontend Application:** `http://your-frontend-env-yourname.your-region.elasticbeanstalk.com`
*   **Backend API Base URL:** `http://<EC2_BACKEND_PUBLIC_IP_ADDRESS>`
    *   **Sample Ping Endpoint:** `http://<EC2_BACKEND_PUBLIC_IP_ADDRESS>/api/ping`

*(Please replace placeholders with your actual live URLs)*

---

## Features Implemented

*   **User Authentication:** Secure user registration and login using JWT (JSON Web Tokens).
*   **User Profile Management:** Users can view and update their profile information, including uploading a profile picture.
*   **CRUD Operations:** Full Create, Read, Update, and Delete functionality for [Your Primary Entity - e.g., Tasks, Posts].
*   **Database Operations:** User management and entity persistence using Amazon DynamoDB, including appropriate GSI usage for efficient querying.
*   **File and Image Upload:** Secure upload of files/images to an AWS S3 bucket, with support for public/private access as configured.
*   **RESTful API Design:** Backend exposes a well-defined set of REST APIs consumed by the frontend.
*   **Cloud-Native Deployment:**
    *   Separated frontend and backend components.
    *   Backend deployed as a Docker container on Amazon EC2.
    *   Frontend deployed using AWS Elastic Beanstalk.
    *   Secure infrastructure within a custom Amazon VPC.
    *   Least-privilege IAM roles and fine-grained security group rules.

---

## Prerequisites for Local Setup/Deployment

*   Node.js (v16.x or newer recommended)
*   NPM (Node Package Manager)
*   AWS CLI (v2 recommended) configured with appropriate IAM user credentials.
*   AWS Elastic Beanstalk CLI (EB CLI)
*   AWS Cloud Development Kit (CDK) CLI (v1.x or v2.x, ensure compatibility with project's CDK version)
*   Docker Desktop (or Docker Engine) installed and running.
*   Git

---

## Local Development Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/HannanI7/aws-cloud-native-deployment-project.git
    cd aws-cloud-native-deployment-project
    ```

2.  **Backend Setup (`userreg-api-node-beanstalk/api-db`):**
    *   Navigate to the backend directory:
        ```bash
        cd userreg-api-node-beanstalk/api-db
        ```
    *   Install dependencies:
        ```bash
        npm install
        ```
    *   Create a `.env` file by copying `.env.example` and fill in the values:
        ```
        # .env example for backend
        PORT=5000
        AWS_REGION=your-aws-region # e.g., me-south-1
        DYNAMODB_TABLE_NAME=userRegistrationTable-yourname # From CDK output or manual setup
        DYNAMODB_TASKS_TABLE_NAME=tasksTable-yourname     # From CDK output or manual setup
        S3_BUCKET_NAME=yourname-app-uploads-bucket  # Your S3 bucket
        JWT_SECRET=yourSuperStrongAndRandomJWTSecret!

        # For local development targeting AWS services (ensure IAM user has permissions)
        # AWS_ACCESS_KEY_ID=YOUR_LOCAL_IAM_USER_ACCESS_KEY
        # AWS_SECRET_ACCESS_KEY=YOUR_LOCAL_IAM_USER_SECRET_KEY
        ```
    *   Start the backend server:
        ```bash
        npm start
        ```
        The backend will be available at `http://localhost:5000`.

3.  **Frontend Setup (`userreg-react-beanstalk`):**
    *   Navigate to the frontend directory:
        ```bash
        cd ../../userreg-react-beanstalk # from api-db, or adjust path from root
        ```
    *   Install dependencies:
        ```bash
        npm install
        ```
    *   Create a `.env` file by copying `.env.example` (if provided) or create one with:
        ```
        # .env for frontend (local development)
        REACT_APP_API_BASE_URL=http://localhost:5000
        ```
    *   Start the frontend development server:
        ```bash
        npm start
        ```
        The frontend will be available at `http://localhost:3000` (or another port if specified).

---

## AWS Deployment Guide

### 1. AWS CDK Resource Provisioning (DynamoDB, ECR, IAM)

This step uses AWS CDK to create DynamoDB tables, an ECR repository for the backend Docker image, and some baseline IAM roles for Elastic Beanstalk.

*   Navigate to the CDK directory:
    ```bash
    cd path/to/your/project/userreg-api-node-beanstalk/cdk
    ```
*   Modify the `resourceNameSuffix` variable in `lib/cdk-stack.ts` to include your unique identifier (e.g., `const resourceNameSuffix = '-yourname';`).
*   Install CDK dependencies:
    ```bash
    npm install
    ```
*   Build the CDK project (transpile TypeScript):
    ```bash
    npm run build
    ```
*   Bootstrap CDK in your target AWS account and region (only needs to be done once per account/region):
    ```bash
    cdk bootstrap aws://YOUR_AWS_ACCOUNT_ID/YOUR_AWS_REGION
    ```
*   Deploy the CDK stack:
    ```bash
    cdk deploy
    ```
*   **Note the outputs from `cdk deploy`**, especially:
    *   `UserTableNameOutput...`
    *   `TasksTableNameOutput...`
    *   `BackendEcrRepoUri...`
    *   `ebInstanceRole...` (or similar for EB EC2 role name)

### 2. Manual AWS Setup (S3 Bucket, VPC)

*   **S3 Bucket:**
    *   Create an S3 bucket (e.g., `yourname-app-uploads-bucket`) in your target AWS region.
    *   If using `public-read` ACLs for uploaded objects, ensure "Block all public access" is appropriately configured (e.g., uncheck the main block, but keep individual blocks for new ACLs/policies off if you control access programmatically).
    *   Configure CORS for the S3 bucket to allow requests from your frontend domain (and `localhost` for testing).
*   **VPC (Virtual Private Cloud):**
    *   In the AWS VPC console, use the "VPC and more" wizard to create a new VPC (e.g., `project-vpc-yourname`).
    *   Configure it with an IPv4 CIDR (e.g., `10.0.0.0/16`), at least 2 Availability Zones, 2 public subnets, and 2 private subnets.
    *   Ensure an Internet Gateway is created and attached, and the public route table has a route `0.0.0.0/0` to this IGW. Select "None" for NAT Gateways for this project.
    *   Note the VPC ID and Public Subnet IDs.

### 3. IAM Role and Policy for Backend EC2 Instance

*   Create an IAM Policy (e.g., `EC2BackendAppPolicy-yourname`) with permissions for:
    *   DynamoDB: `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Query`, `Scan` on your user and tasks tables.
    *   S3: `PutObject`, `GetObject`, `DeleteObject`, `PutObjectAcl` on your S3 uploads bucket.
    *   ECR: `GetAuthorizationToken`, `BatchCheckLayerAvailability`, `GetDownloadUrlForLayer`, `BatchGetImage` (on `*`), and `DescribeImages` on your specific ECR repository.
    *   CloudWatch Logs: `CreateLogGroup`, `CreateLogStream`, `PutLogEvents`, `DescribeLogStreams` for application logging.
*   Create an IAM Role (e.g., `EC2BackendAppRole-yourname`) for EC2 service trust and attach the policy created above.

### 4. Security Group for Backend EC2 Instance

*   Create a Security Group (e.g., `backend-sg-yourname`) within your custom VPC.
*   **Inbound Rules:**
    *   SSH (TCP Port 22) from `My IP` (for your access).
    *   HTTP (TCP Port 80) from `0.0.0.0/0` (to allow public access to the backend application, as Docker will map port 80 on EC2 to the app's internal port).
*   **Outbound Rules:** Default (Allow all outbound) is usually sufficient.

### 5. Backend Dockerization and ECR Push

*   Navigate to the backend directory (`userreg-api-node-beanstalk/api-db`).
*   Ensure `Dockerfile` and `.dockerignore` are present and correctly configured (especially ignoring `.env`).
*   Build the Docker image:
    ```bash
    docker build -t local-backend-image-yourname .
    ```
*   Log in to Amazon ECR:
    ```bash
    aws ecr get-login-password --region YOUR_AWS_REGION | docker login --username AWS --password-stdin YOUR_AWS_ACCOUNT_ID.dkr.ecr.YOUR_AWS_REGION.amazonaws.com
    ```
*   Tag the local image with the ECR repository URI (from CDK output):
    ```bash
    docker tag local-backend-image-yourname:latest YOUR_ECR_IMAGE_URI_FROM_CDK:latest
    ```
*   Push the image to ECR:
    ```bash
    docker push YOUR_ECR_IMAGE_URI_FROM_CDK:latest
    ```

### 6. Backend EC2 Instance Launch

*   In the EC2 console, launch a new instance:
    *   **Name:** `backend-ec2-yourname`
    *   **AMI:** Amazon Linux 2 (Free Tier eligible)
    *   **Instance Type:** `t2.micro` (Free Tier eligible)
    *   **Key Pair:** Select or create your SSH key pair.
    *   **Network Settings:**
        *   VPC: Your custom `project-vpc-yourname`.
        *   Subnet: One of your public subnets.
        *   Auto-assign Public IP: **Enable**.
        *   Firewall (Security Groups): Select your existing `backend-sg-yourname`.
    *   **Advanced Details:**
        *   IAM instance profile: Select your `EC2BackendAppRole-yourname`.
        *   **User Data:** Provide the script to install Docker, log in to ECR, pull your image, and run the container. (A template of this script is provided below or should be in the project files). **Ensure all placeholders in the User Data script (region, account ID, ECR URI, table names, S3 bucket, JWT secret, app port) are correctly replaced.**

    *User Data Script Template (Example):*
    ```bash
    #!/bin/bash
    yum update -y
    amazon-linux-extras install docker -y
    systemctl start docker
    systemctl enable docker
    usermod -a -G docker ec2-user
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && unzip awscliv2.zip && ./aws/install

    YOUR_REGION="your-aws-region"
    YOUR_AWS_ACCOUNT_ID="your-aws-account-id"
    YOUR_ECR_IMAGE_URI="your-ecr-image-uri:latest" # From CDK output
    YOUR_DYNAMODB_USER_TABLE="userRegistrationTable-yourname"
    YOUR_DYNAMODB_TASKS_TABLE="tasksTable-yourname"
    YOUR_S3_BUCKET="yourname-app-uploads-bucket"
    YOUR_JWT_SECRET="yourActualJwtSecretUsedInApp"
    APP_PORT="5000" # Internal container port

    aws ecr get-login-password --region ${YOUR_REGION} | docker login --username AWS --password-stdin ${YOUR_AWS_ACCOUNT_ID}.dkr.ecr.${YOUR_REGION}.amazonaws.com
    docker pull ${YOUR_ECR_IMAGE_URI}
    docker run -d -p 80:${APP_PORT} \
      -e PORT=${APP_PORT} \
      -e AWS_REGION=${YOUR_REGION} \
      -e DYNAMODB_TABLE_NAME=${YOUR_DYNAMODB_USER_TABLE} \
      -e DYNAMODB_TASKS_TABLE_NAME=${YOUR_DYNAMODB_TASKS_TABLE} \
      -e S3_BUCKET_NAME=${YOUR_S3_BUCKET} \
      -e JWT_SECRET=${YOUR_JWT_SECRET} \
      --restart always \
      --name backend-container \
      ${YOUR_ECR_IMAGE_URI}
    ```
*   After launch, get the Public IPv4 address of the EC2 instance. Test the backend API (e.g., `/api/ping`).

### 7. Frontend Deployment to Elastic Beanstalk

*   Navigate to the frontend directory (`userreg-react-beanstalk`).
*   Update/create the `.env` file with the backend's EC2 public IP:
    ```
    REACT_APP_API_BASE_URL=http://<EC2_BACKEND_PUBLIC_IP_ADDRESS>
    ```
*   Build the React application for production:
    ```bash
    npm run build
    ```
*   Initialize Elastic Beanstalk application:
    ```bash
    eb init -p "Node.js" your-frontend-app-yourname
    ```
    Follow prompts: select region, create new application, confirm Node.js, select platform branch, set up SSH with your key pair.
*   Create the Elastic Beanstalk environment (ensure placeholders are replaced):
    ```bash
    eb create your-frontend-env-yourname \
        --vpc.id YOUR_CUSTOM_VPC_ID \
        --vpc.ec2subnets YOUR_PUBLIC_SUBNET_ID_1,YOUR_PUBLIC_SUBNET_ID_2 \
        --vpc.elbsubnets YOUR_PUBLIC_SUBNET_ID_1,YOUR_PUBLIC_SUBNET_ID_2 \
        --instance_profile YOUR_EB_EC2_INSTANCE_ROLE_NAME_FROM_CDK 
        # Example: ebInstanceRole-yourname (the role CDK created for EB instances)
    ```
    Follow prompts: environment name, CNAME prefix, Application Load Balancer.
*   *(Optional but recommended)* If your React app isn't served correctly, add a simple `server.js` at the root of `userreg-react-beanstalk` to serve the `build` folder and update `package.json` "start" script to `node server.js`.
*   If `REACT_APP_API_BASE_URL` is not picked up from a `.env` file during EB deployment (EB typically doesn't use `.env` from your package for runtime), configure it via the Elastic Beanstalk console:
    *   Go to your EB Environment -> Configuration -> Software -> Edit -> Environment properties.
    *   Add `REACT_APP_API_BASE_URL` with the value `http://<EC2_BACKEND_PUBLIC_IP_ADDRESS>`. Apply changes.
*   Once the environment is "Ok" and "Healthy", access it via the provided EB URL.

---

## Troubleshooting Tips (Optional)

*   **EC2 User Data Logs:** `sudo cat /var/log/cloud-init-output.log` on the EC2 instance.
*   **EC2 Docker Logs:** `sudo docker ps -a` and `sudo docker logs backend-container` on the EC2 instance.
*   **Elastic Beanstalk Logs:** Access via EB Console -> Environment -> Logs.
*   **Security Groups:** Double-check inbound/outbound rules for all relevant security groups.
*   **IAM Permissions:** Ensure IAM roles have the necessary policies attached.

---
*(Add any other sections or details specific to your project)*
