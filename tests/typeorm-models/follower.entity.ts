import {Column, Entity, PrimaryColumn} from 'typeorm';

@Entity({name: 'leader_followers'})
export class Follower {
  @PrimaryColumn({
    name: 'leader_id',
  })
  leaderId: number;
  
  @PrimaryColumn({
    name: 'follower_id',
  })
  followerId: number;
  
  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    transformer: {
      from: (value: Date) => value,
      to: (value: Date) => value,
    },
  })
  createdAt: Date;
}