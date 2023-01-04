import {Column, Entity, OneToMany, PrimaryColumn, PrimaryGeneratedColumn} from 'typeorm';

export enum RoleIds {
  ADMIN = 1,
  CUSTOMER = 2,
  MANAGER = 3
}

@Entity({name: 'roles'})
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;
}
