import { Column, DataType, HasMany, Model, Table } from 'sequelize-typescript';
import { User } from './user.entity';

export enum RolesName {
    ADMIN = 'admin',
    CUSTOMER = 'customer',
    MANAGER = 'manager'
}

export enum RoleIds {
    ADMIN = 1,
    CUSTOMER = 2,
    MANAGER = 3
}

@Table({
    timestamps: false,
    tableName: 'roles',
    freezeTableName: true,
})
export class Role extends Model {
    @Column({
        autoIncrement: true,
        unique: true,
        primaryKey: true,
        allowNull: false,
    })
    readonly id: number;

    @Column({
        type: DataType.TEXT,
        allowNull: false,
        unique: true,
        primaryKey: true,
    })
    name: string;

    @HasMany(() => User)
    readonly users: User[];
}

Role.prototype.toJSON =  function () {
    const values = Object.assign({}, this.get());
    delete values.id;
    return values;
}