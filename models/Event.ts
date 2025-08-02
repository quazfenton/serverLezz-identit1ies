import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import User from './User';

interface EventAttributes {
  id: string;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location: string;
  source: 'eventbrite' | 'meetup' | 'partiful' | 'user';
  externalId?: string;
  category: string;
  imageUrl?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface EventCreationAttributes extends Optional<EventAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class Event extends Model<EventAttributes, EventCreationAttributes> implements EventAttributes {
  public id!: string;
  public title!: string;
  public description!: string;
  public startTime!: Date;
  public endTime!: Date;
  public location!: string;
  public source!: 'eventbrite' | 'meetup' | 'partiful' | 'user';
  public externalId?: string;
  public category!: string;
  public imageUrl?: string;
  public createdBy?: string;
  public createdAt!: Date;
  public updatedAt!: Date;
}

Event.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    source: {
      type: DataTypes.ENUM('eventbrite', 'meetup', 'partiful', 'user'),
      allowNull: false,
    },
    externalId: {
      type: DataTypes.STRING,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    imageUrl: {
      type: DataTypes.STRING,
    },
    createdBy: {
      type: DataTypes.UUID,
      references: {
        model: User,
        key: 'id',
      },
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'events',
  }
);

export default Event;