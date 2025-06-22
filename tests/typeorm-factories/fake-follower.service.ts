import {TypeormFakeEntityService} from "../../src";
import {Follower} from "../typeorm-models/follower.entity";

export class FakeFollowerService extends TypeormFakeEntityService<Follower> {
  
  protected setFakeFields(): Partial<Follower> {
    return {
      // Don't set leaderId and followerId by default - they should be provided by tests
      // or through parent/nested relationships
      createdAt: new Date()
    };
  }
}