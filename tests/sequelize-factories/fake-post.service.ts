import { SequelizeFakeEntityService } from '../../src';
import { Post } from '../sequelize-models/post.entity';
import { FakeUserService } from './fake-user.service';
import {faker} from '@faker-js/faker';
import {User} from "../sequelize-models/user.entity";
import {FakeCommentService} from "./fake-comment.service";
import {Comment} from "../sequelize-models/comment.entity";

export class FakePostService extends SequelizeFakeEntityService<Post> {
  constructor(
    public repository: typeof Post,
  ) {
    super(repository)
  }

  setFakeFields(): Partial<Post> {
    return {
      message: faker.lorem.sentence()
    }
  }

  withParentUser(fakeUserService: FakeUserService, each = false, userFields?: Partial<Post>): FakePostService {
    return this.withParent(fakeUserService,
      {
        parent: 'id',
        nested: 'userId'
      },
      each,
      userFields) as FakePostService;
  }

  withComments(fakeCommentService: FakeCommentService, count = 1, commentFields?: Partial<Comment>): FakePostService {
    return this.withNested(
      fakeCommentService,
      {
        parent: 'id',
        nested: 'postId'
      },
      count,
      commentFields) as FakePostService;
  }


}