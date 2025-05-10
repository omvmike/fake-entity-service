import { faker } from '@faker-js/faker';
import { SequelizeFakeEntityService } from '../../src';
import { Comment } from '../sequelize-models/comment.entity';
import { FakePostService } from './fake-post.service';
import { FakeUserService } from './fake-user.service';
import {Post} from "../sequelize-models/post.entity";
import {User} from "../sequelize-models/user.entity";


export class FakeCommentService extends SequelizeFakeEntityService<Comment> {
  constructor(
    public repository: typeof Comment,
  ) {
    super(repository);
  }

  protected setFakeFields(): Partial<Comment> {
    return {
      postId: faker.number.int(),
      userId: faker.number.int(),
      message: faker.lorem.sentence(),
      createdAt: faker.date.recent(),
    };
  }

  withParentPost(fakePostService: FakePostService, each = false, postFields?: Partial<Post>): FakeCommentService {
    return this.withParent(
      fakePostService,
      {
        parent: 'id',
        nested: 'postId'
      },
      each,
      postFields) as FakeCommentService;
  }

  withParentUser(fakeUserService: FakeUserService, each = false, userFields?: Partial<User>): FakeCommentService {
    return this.withParent(
      fakeUserService,
      {
        parent: 'id',
        nested: 'userId'
      },
      each,
      userFields) as FakeCommentService;
  }
}
