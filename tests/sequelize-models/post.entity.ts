import { InferAttributes } from 'sequelize';
import {
  Table,
  Column,
  Model,
  ForeignKey,
  CreatedAt,
  UpdatedAt,
  PrimaryKey,
  AutoIncrement,
  Unique,
  Default,
  Sequelize, BelongsTo, HasMany
} from 'sequelize-typescript';
import { User } from './user.entity';
import { Comment } from './comment.entity';

@Table({
  tableName: 'posts',
  freezeTableName: true,
  underscored: true,
})
export class Post extends Model<
  InferAttributes<Post>,
  IPostCreateAttributes
> {
  @AutoIncrement
  @PrimaryKey
  @Column
  id: number;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @Unique
  @Column
  message: string;

  @Default(Sequelize.literal('CURRENT_TIMESTAMP'))
  @CreatedAt
  @Column
  createdAt: Date;

  @UpdatedAt
  @Column
  updatedAt: Date;

  // Relations
  @BelongsTo(() => User)
  user: User;

  @HasMany(() => Comment)
  comments: Comment[];
}

export interface IPostCreateAttributes {
  userId: number;
  message: string;
}