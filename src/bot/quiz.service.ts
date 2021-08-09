import { Injectable, Logger } from "@nestjs/common";
import { DiscordClientProvider, On, OnCommand } from "discord-nestjs";
import {
  Client,
  Message,
  MessageEmbed,
  TextChannel,
  User,
  VoiceChannel,
  VoiceConnection,
} from "discord.js";
import { songs } from "src/music/song.list";
import { IRound, ISong } from "src/types/types";
import { getRandomFromArray } from "src/utils/array-helper";
import { stringSimilarity } from "string-similarity-js";
import * as ytdl from "discord-ytdl-core";

@Injectable()
export class QuizCommand {
  private readonly logger = new Logger(QuizCommand.name);
  private readonly discordClient: Client;

  private isRunning = false;
  private channel: TextChannel;
  private voiceChannel: VoiceChannel;
  private voiceConnection: VoiceConnection;
  private songs: ISong[];
  private currentIndex: number;
  private rounds: IRound[] = [];

  constructor(private readonly discordProvider: DiscordClientProvider) {
    this.discordClient = discordProvider.getClient();
  }

  @On({ event: "ready" })
  async onReady() {
    this.logger.log("Bot ready!");
  }

  @OnCommand({ name: "quiz" })
  async onStartCommand(message: Message) {
    const author = message.author;

    if (author.bot) return;

    const channel = message.channel as TextChannel;

    if (this.isRunning) {
      await channel.send("A quiz is already running!");
      return;
    }

    this.channel = channel;
    const voiceState = message.member.voice;
    if (!voiceState.channelID) {
      await channel.send("You must be in a voice channel to start a quiz!");
      return;
    }
    this.voiceChannel = voiceState.channel;
    this.voiceConnection = await this.voiceChannel.join();
    await this.beginGame();
  }

  @OnCommand({ name: "join" })
  async onJoin(message: Message) {
    const author = message.author;

    if (author.bot) return;

    const channel = message.channel as TextChannel;

    if (this.isRunning) {
      await channel.send("A quiz is already running!");
      return;
    }

    this.channel = channel;
    const voiceState = message.member.voice;
    if (!voiceState.channelID) {
      await channel.send("You must be in a voice channel to start a quiz!");
      return;
    }
    this.voiceChannel = voiceState.channel;
    this.voiceConnection = await this.voiceChannel.join();
  }

  @On({ event: "message" })
  async onMessage(message: Message) {
    const channel = message.channel as TextChannel;
    if (channel !== this.channel || !this.isRunning) return;

    const author = message.author;

    if (author.bot) return;

    await this.verifyAnswer(message, author);
  }

  private async startPlayback() {
    const song = this.getCurrentSong();

    this.logger.debug(`Playing ${song.title} by ${song.artist}`);

    try {
      const stream = ytdl(
        `https://www.youtube.com/watch?v=${song.youtubeWatchCode}`,
        {
          seek: song.start,
          // begin: `00:00:40.000`,
          filter: "audioonly",
          opusEncoded: true,
        },
      );

      const dispatcher = this.voiceConnection.play(stream, {
        type: "opus",
        volume: 0.5,
      });

      await new Promise((resolve, reject) => {
        setTimeout(async () => {
          resolve(null);
          dispatcher.end();
          await this.nextRound();
        }, 25 * 1000);
      });
    } catch (err) {
      await this.channel.send(`Error: ${err}`);
      this.logger.error(err);
    }
  }

  private async announceSongPoints() {
    const song = this.getCurrentSong();
    const songPoints = this.rounds.find(
      (x) => x.round === this.currentIndex + 1,
    );

    const { artistWonBy, titleWonBy } = songPoints;

    const pointsEmbed = new MessageEmbed()
      .setColor("#0099ff")
      .setTitle(song.title)
      .setDescription(`Artist: ${song.artist}`)
      .addFields(
        {
          name: "Title guessed by",
          value: titleWonBy ? titleWonBy.username : "Nobody",
        },
        {
          name: "Artist guessed by",
          value: artistWonBy ? artistWonBy.username : "Nobody",
        },
      )
      .setFooter(`Round ${this.currentIndex + 1}/${this.songs.length}`);

    await this.channel.send(pointsEmbed);
  }

  private async verifyAnswer(message: Message, user: User) {
    const song = this.getCurrentSong();

    if (!song) return;

    const answer = message.content.toLowerCase();

    const songTitle = song.title.toLowerCase();
    const songArtist = song.artist.toLowerCase();

    const similarityTitle = stringSimilarity(songTitle, answer, 1);
    const similarityArtist = stringSimilarity(songArtist, answer, 1);

    if (similarityTitle < 0.7 && similarityArtist < 0.7) {
      await message.react("❌");
      return;
    }

    const checkEmoji =
      this.discordClient.emojis.cache.get("869021985714360320");

    let currentRound: IRound = this.rounds.find(
      (x) => x.round === this.currentIndex + 1,
    );

    if (!currentRound) currentRound = { round: this.currentIndex + 1 };

    if (similarityTitle >= 0.7 && !currentRound.titleWonBy) {
      currentRound.titleWonBy = user;
      await message.react(checkEmoji);
    } else if (similarityArtist >= 0.7 && !currentRound.artistWonBy) {
      currentRound.artistWonBy = user;
      await message.react(checkEmoji);
    } else {
      return;
    }

    this.rounds = [
      ...this.rounds.filter((x) => x.round !== currentRound.round),
      currentRound,
    ];

    if (currentRound.titleWonBy && currentRound.artistWonBy) {
      await this.channel.send("Yes! Perfektně! Enjoy the rest of the song.");
    }
  }

  private async beginGame() {
    this.isRunning = true;
    this.songs = await this.getSongs();
    this.currentIndex = -1;

    await this.channel.send("Quiz began");

    await this.nextRound(false);
  }

  private async endGame() {
    await this.channel.send("Quiz ended");
    const rounds = this.rounds;

    this.isRunning = false;
    this.channel = null;
    this.voiceChannel = null;
    this.voiceConnection = null;
  }

  private async nextRound(announceSongFirst = true) {
    if (announceSongFirst) this.announceSongPoints();
    this.currentIndex++;

    if (this.currentIndex >= this.songs.length) {
      await this.endGame();
      return;
    }

    let currentRound: IRound = this.rounds.find(
      (x) => x.round === this.currentIndex + 1,
    );

    if (!currentRound) currentRound = { round: this.currentIndex + 1 };

    this.rounds = [
      ...this.rounds.filter((x) => x.round !== currentRound.round),
      currentRound,
    ];

    await this.startPlayback();
  }

  private getCurrentSong() {
    return this.songs[this.currentIndex];
  }

  private async getSongs(count: number = 15) {
    count = songs.length < count ? songs.length : count;

    let randomSongs = [];

    while (randomSongs.length < count) {
      const rSong = getRandomFromArray(songs);
      if (!randomSongs.includes(rSong)) randomSongs.push(rSong);
    }

    return randomSongs;
  }
}
