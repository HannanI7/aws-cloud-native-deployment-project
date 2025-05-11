// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

// Permission is hereby granted, free of charge, to any person obtaining a copy of
// this software and associated documentation files (the "Software"), to deal in
// the Software without restriction, including without limitation the rights to
// use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
// the Software, and to permit persons to whom the Software is furnished to do so.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
// FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
// IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
// CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// import * as cdk from '@aws-cdk/core';
// import * as dynamodb from '@aws-cdk/aws-dynamodb';
// import * as ecr from '@aws-cdk/aws-ecr';
// import { Role, ServicePrincipal, ManagedPolicy, CfnInstanceProfile } from '@aws-cdk/aws-iam';

// export class CdkStack extends cdk.Stack {
//   constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
//     super(scope, id, props);

//     // The code that defines your stack goes here
//     const table = new dynamodb.Table(this, 'signup', {
//       partitionKey: { 
//         name: 'email', 
//         type: dynamodb.AttributeType.STRING 
//       },
//       tableName: 'signup',
//       // The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
//       // the new table, and it will remain in your account until manually deleted. By setting the policy to 
//       // DESTROY, cdk destroy will delete the table (even if it has data in it)
//       removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
//     });

//     const ecrRepo = new ecr.Repository(this, 'user-reg-db');

//     const ecrRepoSNS = new ecr.Repository(this, 'user-reg-sns');

//     const beanstalkEC2Instancerole = new Role(this, 'aws-elasticbeanstalk-ec2-role', {
//       assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
//       roleName: 'aws-elasticbeanstalk-ec2-role'
//     });
//     beanstalkEC2Instancerole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryFullAccess'));
//     beanstalkEC2Instancerole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'));
//     beanstalkEC2Instancerole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWebTier'));
//     beanstalkEC2Instancerole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkMulticontainerDocker'));
//     beanstalkEC2Instancerole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWorkerTier'));
//     beanstalkEC2Instancerole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonSNSFullAccess'));

//     const beanstalkEC2Instance = new CfnInstanceProfile(this, "InstanceProfile", {
//       roles: [beanstalkEC2Instancerole.roleName],
//       instanceProfileName: 'aws-elasticbeanstalk-ec2-role'
//     });

//     const beanstalkServicerole = new Role(this, 'aws-elasticbeanstalk-service-role', {
//       assumedBy: new ServicePrincipal('elasticbeanstalk.amazonaws.com'),
//       roleName: 'aws-elasticbeanstalk-service-role'
//     });
//     beanstalkServicerole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSElasticBeanstalkEnhancedHealth'));
//     beanstalkServicerole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSElasticBeanstalkService'));

//   }
// }
// userreg-api-node-beanstalk/cdk/lib/cdk-stack.ts
import * as cdk from '@aws-cdk/core';
import *as table from '@aws-cdk/aws-dynamodb'; // Corrected import
import * as iam from '@aws-cdk/aws-iam';
import * as ecr from '@aws-cdk/aws-ecr';
import * as sns from '@aws-cdk/aws-sns';
// import * as subscriptions from '@aws-cdk/aws-sns-subscriptions';

// Suffix for resource names to ensure uniqueness and include your name
const resourceNameSuffix = '-yourname'; // <<<<<<< IMPORTANT: SET YOUR NAME/ID HERE

export class CdkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- 1. DynamoDB Table for Users ---
    const userTable = new table.Table(this, `userRegistrationTable${resourceNameSuffix}`, {
      tableName: `userRegistrationTable${resourceNameSuffix}`, // This will be your DYNAMODB_TABLE_NAME
      partitionKey: { name: 'userId', type: table.AttributeType.STRING },
      billingMode: table.BillingMode.PAY_PER_REQUEST, // Good for dev/testing
      removalPolicy: cdk.RemovalPolicy.DESTROY, // DESTROY for dev, RETAIN for prod
    });

    // Add GSI for querying by email
    userTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: table.AttributeType.STRING },
      projectionType: table.ProjectionType.ALL,
    });
    // Output the user table name
    new cdk.CfnOutput(this, `UserTableNameOutput${resourceNameSuffix}`, {
      value: userTable.tableName,
      description: 'Name of the User DynamoDB table',
    });


    // --- 2. DynamoDB Table for Tasks ---
    const tasksTable = new table.Table(this, `tasksTable${resourceNameSuffix}`, {
      tableName: `tasksTable${resourceNameSuffix}`, // This will be DYNAMODB_TABLE_NAME + '-tasks'
      partitionKey: { name: 'taskId', type: table.AttributeType.STRING },
      billingMode: table.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for querying tasks by userId
    tasksTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'userId', type: table.AttributeType.STRING },
      projectionType: table.ProjectionType.ALL,
    });
    // Output the tasks table name
    new cdk.CfnOutput(this, `TasksTableNameOutput${resourceNameSuffix}`, {
      value: tasksTable.tableName,
      description: 'Name of the Tasks DynamoDB table',
    });


    // --- IAM Roles (Original from repo, review if needed for your EC2 backend) ---
    // The original repo creates roles for Elastic Beanstalk.
    // For our EC2 deployment, we will create a more specific role later,
    // but these might create some baseline policies useful for Beanstalk (frontend).

    // IAM Role for Elastic Beanstalk EC2 Instances (Frontend)
    const ebInstanceRole = new iam.Role(this, `ebInstanceRole${resourceNameSuffix}`, {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      roleName: `eb-ec2-instance-role${resourceNameSuffix}`,
    });
    // Allow Beanstalk instances to read from S3 (e.g., for app versions) and write logs
    ebInstanceRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWebTier'));
    ebInstanceRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSElasticBeanstalkWorkerTier')); // May not be needed for just web tier
    ebInstanceRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy')); // For CloudWatch Logs

    // IAM Role for Elastic Beanstalk Service (Frontend)
    const ebServiceRole = new iam.Role(this, `ebServiceRole${resourceNameSuffix}`, {
      assumedBy: new iam.ServicePrincipal('elasticbeanstalk.amazonaws.com'),
      roleName: `eb-service-role${resourceNameSuffix}`,
    });
    ebServiceRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSElasticBeanstalkService'));
    ebServiceRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSElasticBeanstalkEnhancedHealth'));

    // --- ECR Repositories (We might create one for our backend manually or via CLI later) ---
    // The original repo sets up ECR. We can use this or create one manually.
    // Let's create one for our single backend service.
    const backendEcrRepo = new ecr.Repository(this, `backendServiceRepo${resourceNameSuffix}`, {
        repositoryName: `backend-service-repo${resourceNameSuffix}`, // For your Dockerized backend
        removalPolicy: cdk.RemovalPolicy.DESTROY, // Or RETAIN
        imageScanOnPush: true,
    });
    new cdk.CfnOutput(this, `BackendEcrRepoUri${resourceNameSuffix}`, {
        value: backendEcrRepo.repositoryUri,
        description: 'URI of the ECR repository for the backend service',
    });


    // --- SNS Topic (From original repo, less relevant for our core backend, but keep for now) ---
    const snsTopic = new sns.Topic(this, `userRegSnsTopic${resourceNameSuffix}`, {
      displayName: 'User Registration SNS Topic',
      topicName: `user-reg-sns-topic${resourceNameSuffix}`
    });
    // Example: Add an email subscription (replace with your email)
    // snsTopic.addSubscription(new subscriptions.EmailSubscription('your-email@example.com'));

    new cdk.CfnOutput(this, `SnsTopicArn${resourceNameSuffix}`, {
      value: snsTopic.topicArn,
      description: 'ARN of the SNS Topic for User Registration',
    });


    // --- Granting Permissions (Example if roles needed to access DynamoDB/SNS) ---
    // If the EB instance role (for frontend if it ever needed direct DB access, not typical)
    // or a future EC2 role needed access:
    // userTable.grantReadWriteData(ebInstanceRole);
    // tasksTable.grantReadWriteData(ebInstanceRole);
    // snsTopic.grantPublish(ebInstanceRole);

    // We will create a specific IAM Role for the Backend EC2 instance later and grant it
    // permissions to these DynamoDB tables and the S3 bucket.
  }
}