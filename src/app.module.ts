import { RemoteGraphQLDataSource } from '@apollo/gateway';
import { Module } from '@nestjs/common';
import { GATEWAY_BUILD_SERVICE, GraphQLGatewayModule } from '@nestjs/graphql';
import { JwtModule } from '@nestjs/jwt';

import { ConfigModule } from '@lib/config';
import { IORedisModule } from '@lib/ioredis';

import * as Gateway from '../gateway.json';
import { ApisModules } from './api/api.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IORedisController } from './ioredis/ioredis.controller';
import { JwtsModule } from './lib/jwts/jwts.module';
import { PwdModule } from './pwd/pwd.module';

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
class AuthenticatedDataSource extends RemoteGraphQLDataSource {
  async willSendRequest({ request, context }) {
    console.log('context:', context.headers);

    request.http.headers.set(
      'x-api-key',
      context.headers && context.headers['x-api-key'] ? context.headers['x-api-key'] : null
    );
    request.http.headers.set(
      'authorization',
      context.headers && context.headers['authorization'] ? context.headers['authorization'] : null
    );
  }
}

@Module({
  providers: [
    {
      provide: AuthenticatedDataSource,
      useValue: AuthenticatedDataSource
    },
    {
      provide: GATEWAY_BUILD_SERVICE,
      useFactory: AuthenticatedDataSource => {
        return ({ name, url }) => new AuthenticatedDataSource({ url });
      },
      inject: [AuthenticatedDataSource]
    }
  ],
  exports: [GATEWAY_BUILD_SERVICE]
})
class BuildServiceModule {}
@Module({
  imports: [
    GraphQLGatewayModule.forRootAsync({
      useFactory: async () => ({
        gateway: {
          serviceList: process.env.NODE_ENV == 'production' ? Gateway.proServiceLists : Gateway.devServiceLists
        },
        server: {
          context: ({ req }) => ({
            headers: req.headers
          })
        }
      }),
      imports: [BuildServiceModule],
      inject: [GATEWAY_BUILD_SERVICE]
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRED }
    }),
    ConfigModule,
    IORedisModule,
    ApisModules,
    PwdModule,
    JwtsModule
  ],
  controllers: [AppController, IORedisController],
  providers: [AppService]
})
export class AppModule {}
// export class AppModule implements NestModule {
//   configure(consumer: MiddlewareConsumer) {
//     consumer.apply(AuthMiddleware).forRoutes('graphql');
//   }
// }
