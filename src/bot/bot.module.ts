import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DiscordModule, TransformPipe, ValidationPipe } from "discord-nestjs";
import { QuizCommand } from "./quiz.service";

@Module({
  imports: [
    ConfigModule.forRoot(),
    DiscordModule.forRoot({
      commandPrefix: "!",
      token: process.env.DISCORD_TOKEN,
      usePipes: [TransformPipe, ValidationPipe],
    }),
  ],
  providers: [QuizCommand],
  exports: [],
})
export class BotModule {}
