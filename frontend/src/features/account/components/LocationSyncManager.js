import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectUserId } from '../store/authSlice';
import { syncLocation } from '../store/profileSlice';

// Fresh GPS fix (not the cached one) while signed in → syncLocation; see docs/specs/services.md#frontend.
export default function LocationSyncManager() {
  const dispatch = useDispatch();
  const userId = useSelector(selectUserId);
  const { coords, status } = useSelector((state) => state.location);

  useEffect(() => {
    if (userId && coords && status === 'ready') dispatch(syncLocation());
  }, [userId, coords, status, dispatch]);

  return null;
}
