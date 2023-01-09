import {SequelizeFakeEntityService} from "../../src";
import {LeaderFollower} from "../sequelize-models/leader-follower.entity";


export class FakeLeaderFollowerService extends SequelizeFakeEntityService<LeaderFollower> {
  constructor(
    public repository: typeof LeaderFollower,
  ) {
    super(repository)
  }

}